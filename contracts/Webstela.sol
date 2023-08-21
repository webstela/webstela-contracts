// SPDX-License-Identifier: NONE

pragma solidity ^0.8.21;

import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

/**
 * @title Webstela
 * @author Kang Myung-hun
 */

contract Base {
    struct Token {
        address owner;
        address royaltyHolder;
        uint256 price;
        bytes32 hashed;    // SHA256
        bytes32 namespace; // UTF-8
        string  uri;
        mapping(bytes32 => bytes32) meta; // custom meta data
    }

    struct MintFeeTable {
        uint256 on;      // permyriad
        uint256 royalty; // permyriad
    }

    struct BuyFeeTable {
        uint256 fee;     // royalty + implicit contract owner commission
        uint256 royalty; // permyriad
    }

    struct Transferring {
        address to;
        uint256 value;
    }

    address internal _contractOwner; // contract owner
    address internal _manager;

    string internal _name;
    string internal _symbol;
    string internal _baseURI;

    uint256 internal _tokenIdCounter;
    MintFeeTable internal _mintFeeTable;
    BuyFeeTable internal _buyFeeTable;

    mapping(uint256 => Token) internal _tokens;
    mapping(bytes32 => uint256) internal _hashedToTokenIds;
    mapping(address => uint256) internal _balances;
    mapping(address => uint256) internal _names;
    
    mapping(uint256 => address) internal _tokenApprovals;
    mapping(address => mapping(address => bool)) internal _operatorApprovals;

    event Symbol(string indexed symbol);
    event ContractOwner(address indexed from, address indexed to);
    event Manager(address indexed from, address indexed to);

    event MintFee(uint256 on, uint256 royalty);
    event BuyFee(uint256 fee, uint256 royalty);

    event TokenURIBase(string uri);

    event AccountName(address indexed owner, bytes32 indexed name);
    event Mint(uint256 indexed tokenId, bytes32 indexed hashed, bytes32 indexed on);
    event Buy(uint256 indexed tokenID, uint256 price);
    event TokenMeta(
        uint256 indexed tokenId,
        bytes32[] keys,
        bytes32[] values
    );
    event TokenNamespace(uint256 indexed tokenId, bytes32 indexed namespace);
    event TokenRoyaltyHolder(uint256 indexed tokenId, address indexed holder);
    event TokenPrice(uint256 indexed tokenId, uint256 to);
    event TokenURI(uint256 indexed tokenId, string uri);


    /* IERC721 */

    event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);
    event Approval(address indexed owner, address indexed approved, uint256 indexed tokenId);
    event ApprovalForAll(address indexed owner, address indexed operator, bool approved);


    /* Utils */

    function _msgSender() internal view returns (address) {
        return msg.sender;
    }

    function _isContract(address account) internal view returns (bool) {
        return account.code.length > 0;
    }

    function _checkTokenOwner(address owner) internal view {
        require(owner == _msgSender(), "caller is not the token owner");
    }

    function _transferEthers(address to, uint256 value) internal returns (uint256 refund) {
        if (to == address(0) || to == address(this) || to == _contractOwner) return 0;
        if (to == _msgSender()) return value;
        payable(to).transfer(value);
    }

    function _transferEthers(Transferring memory a, Transferring memory b) internal returns (uint256 refund) {
        if (a.to == b.to) {
            return _transferEthers(a.to, a.value + b.value);
        }
        return _transferEthers(a.to, a.value) + _transferEthers(b.to, b.value);
    }

    function _setTokenPrice(uint256 tokenId, Token storage token, uint256 to) internal {
        require(to <= 100_00 * to, "too high price");
        if (token.price == to) return;

        token.price = to;
        emit TokenPrice(tokenId, to);
    }
}

contract Managed is Base {
    function contractOwner() public view returns (address) {
        return _contractOwner;
    }

    function manager() public view returns (address) {
        return _manager;
    }

    function setContractOwner(address to) public onlyContractOwner {
        require(to.balance > 0, "invalid address");
        withdraw();

        address from = _contractOwner;
        _contractOwner = to;
        emit ContractOwner(from, to);
    }

    function setManager(address to) public {
        require(
            _contractOwner == _msgSender() || _manager == _msgSender(),
            "caller is not the contract owner or the manager"
        );
        address from = _manager;
        _manager = to;
        emit Manager(from, to);
    }

    function setTokenURIBase(string calldata baseURI) public onlyManager {
        _baseURI = baseURI;
        emit TokenURIBase(baseURI);
    }

    function setMintFee(uint256 on, uint256 royalty) public onlyManager {
        require(100_00 > on + royalty, "too low commission");

        _mintFeeTable.on = on;
        _mintFeeTable.royalty = royalty;
        // commission = 100_00 - on - royalty;

        emit MintFee(on, royalty);
    }

    function setBuyFee(uint256 fee, uint256 royalty) public onlyManager {
        require(100_00 > fee, "too high fee");
        require(fee > royalty, "too low commission");

        _buyFeeTable.fee = fee;
        _buyFeeTable.royalty = royalty;
        // commission = fee - royalty;

        emit BuyFee(fee, royalty);
    }

    function withdraw() public {
        payable(_contractOwner).transfer(address(this).balance);
    }

    function callFor(
        address to,
        uint256 value,
        uint256 gas,
        bytes calldata data
    ) public payable onlyContractOwner() returns (bool, bytes memory) {
        return to.call{value: value, gas: gas}(data);
    }

    modifier onlyContractOwner() {
        require(_contractOwner == _msgSender(), "caller is not the contract owner");
        _;
    }

    modifier onlyManager() {
        require(_manager == _msgSender(), "caller is not the manager");
        _;
    }
}

contract ERCToken is Managed {
    using Strings for uint256;

    function totalSupply() public view returns (uint256) {
        return _tokenIdCounter - 1;
    }


    /* IERC615 */

    function supportsInterface(bytes4 interfaceId) public pure returns (bool) {
        return
            interfaceId == 0x01ffc9a7 || // ERC165
            interfaceId == 0x80ac58cd || // ERC721
            interfaceId == 0x5b5e139f;   // ERC721Metadata
    }


    /* IERC721Metadata */

    function name() public view returns (string memory) {
        return _name;
    }

    function symbol() public view returns (string memory) {
        return _symbol;
    }

    function tokenURI(uint256 tokenId) public view returns (string memory) {
        string memory uri = _tokens[tokenId].uri;
        if (bytes(uri).length > 0) {
            return uri;
        }
        return string(abi.encodePacked(_baseURI, tokenId.toString()));
    }

    function setSymbol(string calldata to) external onlyManager() {
        _symbol = to;
        emit Symbol(to);
    }

    function setTokenURI(uint256 tokenId, string calldata uri) external {
        Token storage token = _tokens[tokenId];
        _checkTokenOwner(token.owner);

        token.uri = uri;
        emit TokenURI(tokenId, uri);
    }


    /* IERC721 */

    function balanceOf(address owner) public view returns (uint256) {
        require(owner != address(0), "address zero is not a valid owner");

        return _balances[owner];
    }

    function ownerOf(uint256 tokenId) public view returns (address) {
        address owner = _ownerOf(tokenId);

        return owner;
    }

    function approve(address to, uint256 tokenId) public {
        address owner = ownerOf(tokenId);
        require(to != owner, "approval to current owner");
        require(
            _msgSender() == owner || isApprovedForAll(owner, _msgSender()),
            "approve caller is not the token owner or the approved for all"
        );

        _approve(to, tokenId);
    }

    function getApproved(uint256 tokenId) public view returns (address) {
        return _tokenApprovals[tokenId];
    }

    function setApprovalForAll(address operator, bool approved) public {
        _setApprovalForAll(_msgSender(), operator, approved);
    }

    function isApprovedForAll(address owner, address operator) public view returns (bool) {
        return _operatorApprovals[owner][operator];
    }

    function transferFrom(
        address from,
        address to,
        uint256 tokenId
    ) public {
        require(_isApprovedOrOwner(_msgSender(), tokenId), "caller is not the token owner or the approved");

        _transfer(from, to, tokenId);
        _setTokenPrice(tokenId, _tokens[tokenId], 0);
    }

    function safeTransferFrom(
        address from,
        address to,
        uint256 tokenId
    ) public {
        safeTransferFrom(from, to, tokenId, "");
    }

    function safeTransferFrom(
        address from,
        address to,
        uint256 tokenId,
        bytes memory data
    ) public {
        require(_isApprovedOrOwner(_msgSender(), tokenId), "caller is not the token owner or the approved");

        _safeTransfer(from, to, tokenId, data);
        _setTokenPrice(tokenId, _tokens[tokenId], 0);
    }


    /* Internal */

    function _safeTransfer(
        address from,
        address to,
        uint256 tokenId,
        bytes memory data
    ) internal {
        _transfer(from, to, tokenId);
        require(_checkOnERC721Received(from, to, tokenId, data), "transfer to non ERC721Receiver implementer");
    }

    function _ownerOf(uint256 tokenId) internal view returns (address) {
        return _tokens[tokenId].owner;
    }

    function _isApprovedOrOwner(address spender, uint256 tokenId) internal view returns (bool) {
        address owner = ownerOf(tokenId);
        return (spender == owner || isApprovedForAll(owner, spender) || getApproved(tokenId) == spender);
    }

    function _transfer(
        address from,
        address to,
        uint256 tokenId
    ) internal {
        require(ownerOf(tokenId) == from, "transfer from incorrect owner");
        require(to != address(0), "transfer to the zero address");

        if (_tokenApprovals[tokenId] != address(0)) {
            delete _tokenApprovals[tokenId];
        }

        unchecked {
            _balances[from] -= 1;
            _balances[to] += 1;
        }
        _tokens[tokenId].owner = to;

        if (_names[from] == tokenId) {
            delete _names[from];
            emit AccountName(from, "");
        }

        emit Transfer(from, to, tokenId);
    }

    function _approve(address to, uint256 tokenId) internal {
        _tokenApprovals[tokenId] = to;
        emit Approval(ownerOf(tokenId), to, tokenId);
    }

    function _setApprovalForAll(
        address owner,
        address operator,
        bool approved
    ) internal {
        require(owner != operator, "approve to caller");
        _operatorApprovals[owner][operator] = approved;
        emit ApprovalForAll(owner, operator, approved);
    }

    function _checkOnERC721Received(
        address from,
        address to,
        uint256 tokenId,
        bytes memory data
    ) internal returns (bool) {
        if (_isContract(to)) {
            try IERC721Receiver(to).onERC721Received(_msgSender(), from, tokenId, data) returns (bytes4 retval) {
                return retval == IERC721Receiver.onERC721Received.selector;
            } catch (bytes memory reason) {
                if (reason.length == 0) {
                    revert("transfer to non ERC721Receiver implementer");
                } else {
                    assembly {
                        revert(add(32, reason), mload(reason))
                    }
                }
            }
        } else {
            return true;
        }
    }
}

contract HashableToken is ERCToken {
    function tokenIdOf(bytes32 hashed) public view returns (uint256) {
        return _hashedToTokenIds[hashed];
    }

    function ownerOf(bytes32 hashed) public view returns (address) {
        return ownerOf(tokenIdOf(hashed));
    }

    function hashOf(uint256 tokenId) public view returns (bytes32) {
        return _tokens[tokenId].hashed;
    }

    function mintByManager(
        bytes32 hashed,
        bytes32 on,
        address creator,
        address to,
        uint256 price,
        uint256 nextPrice
    ) external payable onlyManager {
        require(to != address(0), "invalid token owner");

        _mint(hashed, on, creator, to, price, nextPrice);
    }

    function mintBatchByManager(
        bytes32[] calldata hashes,
        bytes32 on,
        address creator,
        address to,
        uint256 price,
        uint256[] calldata nextPrices
    ) external payable onlyManager {
        require(to != address(0), "invalid token owner");

        _mintBatch(hashes, on, creator, to, price, nextPrices);
    }

    function mint(
        bytes32 hashed,
        bytes32 on,
        address creator,
        uint256 price,
        uint256 nextPrice,
        uint256 discount,
        uint256 timeout,
        bytes calldata signature
    ) external payable {
        address to = _msgSender();
        bytes32 challenge = sha256(abi.encodePacked(hashed, on, creator, to, price, discount, timeout));
        _validateMinting(
            price,
            discount,
            timeout,
            challenge,
            signature
        );

        _mint(hashed, on, creator, to, price, nextPrice);
    }

    function mintBatch(
        bytes32[] calldata hashes,
        bytes32 on,
        address creator,
        uint256 price,
        uint256[] calldata nextPrices,
        uint256 discount,
        uint256 timeout,
        bytes calldata signature
    ) external payable {
        address to = _msgSender();
        bytes32 challenge = sha256(abi.encodePacked(hashes, on, creator, to, price, discount, timeout));
        _validateMinting(
            price,
            discount,
            timeout,
            challenge,
            signature
        );

        _mintBatch(hashes, on, creator, to, price, nextPrices);
    }

    function _validateMinting(
        uint256 price,
        uint256 discount,
        uint256 timeout,
        bytes32 challenge,
        bytes calldata signature
    ) private {
        require(timeout > block.timestamp, "timed out");
        require(msg.value >= price - discount, "not enough ethers");
        require(manager() == ECDSA.recover(
            keccak256(
                abi.encodePacked("\x19Ethereum Signed Message:\n32", challenge)
            ),
            signature
        ), "invalid signature");
    }

    function _mint(
        bytes32 hashed,
        bytes32 on,
        address creator,
        address to,
        uint256 price,
        uint256 nextPrice
    ) private {
        require(creator != address(0), "invalid token creator");

        uint256 tokenId = _tokenIdCounter;
        _unsafeMint(tokenId, hashed, on, creator, to, price, nextPrice);
        _completeMint(on, creator, to, price, 1);
    }

    function _mintBatch(
        bytes32[] calldata hashes,
        bytes32 on,
        address creator,
        address to,
        uint256 price,
        uint256[] calldata nextPrices
    ) private {
        require(creator != address(0), "invalid token creator");

        uint256 len = hashes.length;
        require(len == nextPrices.length, "invalid next prices");
        for (uint256 i = 0; i < len; i++) {
            _unsafeMint(_tokenIdCounter + i, hashes[i], on, creator, to, price, nextPrices[i]);
        }
        _completeMint(on, creator, to, price, len);
    }

    function _unsafeMint(
        uint256 tokenId,
        bytes32 hashed,
        bytes32 on,
        address creator,
        address to,
        uint256 price,
        uint256 nextPrice
    ) private {
        require(hashed != "", "invalid hashed");
        require(_hashedToTokenIds[hashed] == 0, "already exists");

        emit Mint(tokenId, hashed, on);
        emit TokenRoyaltyHolder(tokenId, creator);
        emit TokenPrice(tokenId, price);

        _hashedToTokenIds[hashed] = tokenId;
        Token storage token = _tokens[tokenId];
        token.owner = to;
        token.hashed = hashed;
        token.royaltyHolder = creator;

        emit Buy(tokenId, price);
        emit Transfer(address(0), to, tokenId);
        _setTokenPrice(tokenId, token, nextPrice);
    }

    function _completeMint(
        bytes32 on,
        address creator,
        address to,
        uint256 price,
        uint256 count
    ) private {
        unchecked {
            _tokenIdCounter += count;
            _balances[to] += count;
        }

        _transferEthers(
            Transferring(creator, price * _mintFeeTable.royalty / 100_00),
            Transferring(ownerOf(on), price * _mintFeeTable.on / 100_00)
        );
    }
}

contract Webstela is HashableToken {
    constructor(address manager) {
        _contractOwner = msg.sender;
        _manager = manager;

        _name = "Webstela";
        _symbol = "WSTLA";
        _baseURI = "https://static.webstela.com/nft/";

        _tokenIdCounter = 1;

        _mintFeeTable.on = 20_00;
        _mintFeeTable.royalty = 70_00;
        // 10% commission

        _buyFeeTable.fee = 10_00;
        _buyFeeTable.royalty = 5_00;
        //  5% commission

        emit Symbol(_symbol);
        emit ContractOwner(address(0), _contractOwner);
        emit Manager(address(0), _manager);

        emit TokenURIBase(_baseURI);
        emit MintFee(
            _mintFeeTable.on,
            _mintFeeTable.royalty
        );
        emit BuyFee(_buyFeeTable.fee, _buyFeeTable.royalty);
    }

    fallback() external payable {}
    receive() external payable {}


    /* Namespace */

    /// @return namespace UTF-8
    function namespaceOf(uint256 tokenId) public view returns (bytes32) {
        return _tokens[tokenId].namespace;
    }

    /// @return namespace UTF-8
    function nameOf(address owner) public view returns (bytes32) {
        return namespaceOf(_names[owner]);
    }

    function setAccountName(uint256 tokenId) external {
        Token storage token = _tokens[tokenId];
        _checkTokenOwner(token.owner);
        require(token.namespace != "", "invalid namespace");

        _names[token.owner] = tokenId;
        emit AccountName(token.owner, token.namespace);
    }

    /// @param namespace UTF-8
    function setTokenNamespace(uint256 tokenId, bytes calldata namespace) public {
        for (uint i = 0; i < namespace.length; i++) {
            uint8 char = uint8(namespace[i]);
            require(
                (char > 47 && char < 58) ||
                (char > 96 && char < 123), "invalid namespace - only lowercased alphanumeric");
        }
        _unsafeSetTokenNamespace(tokenId, namespace);
    }

    /// @param namespace UTF-8
    function unsafeSetTokenNamespace(uint256 tokenId, bytes calldata namespace) public onlyManager {
        _unsafeSetTokenNamespace(tokenId, namespace);
    }

    function _unsafeSetTokenNamespace(uint256 tokenId, bytes calldata namespace) private {
        Token storage token = _tokens[tokenId];

        require(namespace.length < 33, "invalid namespace length");
        require(token.hashed == sha256(namespace), "invalid namespace hash");

        token.namespace = bytes32(namespace);
        emit TokenNamespace(tokenId, token.namespace);
    }


    /* Meta */

    function valueOf(uint256 tokenId, bytes32 key) public view returns (bytes32) {
        return _tokens[tokenId].meta[key];
    }

    function valueOf(bytes32 hashed, bytes32 key) public view returns (bytes32) {
        return valueOf(tokenIdOf(hashed), key);
    }

    function setTokenMeta(uint256 tokenId, bytes32[] calldata keys, bytes32[] calldata values) external {
        Token storage token = _tokens[tokenId];
        _checkTokenOwner(token.owner);
        require(keys.length == values.length, "invalid key value pairs");

        for (uint256 i = 0; i < keys.length; ++i) {
            token.meta[keys[i]] = values[i];
        }
        emit TokenMeta(tokenId, keys, values);
    }


    /* Account Migration */

    function migrateAccount(address to, uint256[] calldata tokenIds) public {
        address from = _msgSender();
        uint256 balance = 0;
        for (uint256 i = 0; i < tokenIds.length; i++) {
            uint256 tokenId = tokenIds[i];
            Token storage token = _tokens[tokenId];
            if (from == token.royaltyHolder) {
                token.royaltyHolder = to;
                emit TokenRoyaltyHolder(tokenId, to);
            }
            if (from == token.owner) {
                token.owner = to;
                emit Transfer(from, to, tokenId);
                balance += 1;
            }
        }
        if (balance > 0) {
            _balances[from] -= balance;
            _balances[to] += balance;
        }
    }


    /* Market */

    function royaltyHolderOf(uint256 tokenId) public view returns (address) {
        return _tokens[tokenId].royaltyHolder;
    }

    function priceOf(uint256 tokenId) public view returns (uint256) {
        return _tokens[tokenId].price;
    }

    function setTokenRoyaltyHolder(uint256 tokenId, address to) external {
        Token storage token = _tokens[tokenId];
        require(token.royaltyHolder == _msgSender(), "caller is not the royalty holder");

        token.royaltyHolder = to;
        emit TokenRoyaltyHolder(tokenId, to);
    }

    function setTokenPrice(uint256 tokenId, uint256 price) external {
        Token storage token = _tokens[tokenId];
        _checkTokenOwner(token.owner);
        _setTokenPrice(tokenId, token, price);
    }

    function buyFor(uint256 tokenId, uint256 nextPrice, address _for) public payable {
        Token storage token = _tokens[tokenId];

        address from = token.owner;
        uint256 price = token.price;
        require(price > 0, "locked to sell");
        require(msg.value >= price, "not enough ethers");

        uint256 royalty = price * _buyFeeTable.royalty / 100_00;
        uint256 net = price * (100_00 - _buyFeeTable.fee) / 100_00;

        emit Buy(tokenId, price);
        _transfer(from, _for, tokenId);
        _setTokenPrice(tokenId, token, nextPrice);

        uint256 refund;
        if (msg.value > price) {
            refund = msg.value - price;
        }
        refund += _transferEthers(token.royaltyHolder, royalty);
        refund += _transferEthers(from, net);
        if (refund > 0) {
            payable(_msgSender()).transfer(refund);
        }
    }

    function buy(uint256 tokenId, uint256 nextPrice) public payable {
       buyFor(tokenId, nextPrice, _msgSender()); 
    }

    function buyBatch(uint256[] calldata tokenIds, uint256[] calldata nextPrices) public payable {
        require(tokenIds.length == nextPrices.length, "invalid arguments");

        address sender = _msgSender();
        address[] memory addresses = new address[](tokenIds.length * 2);
        uint256[] memory values = new uint256[](tokenIds.length * 2);
        uint256 total;

        for (uint256 i = 0; i < tokenIds.length; ++i) {
            uint256 tokenId = tokenIds[i];

            Token storage token = _tokens[tokenId];
            uint256 price = token.price;
            require(price > 0, "locked to sell");

            uint256 royalty = price * _buyFeeTable.royalty / 100_00;
            uint256 net = price * (100_00 - _buyFeeTable.fee) / 100_00;

            _transferring(addresses, values, token.royaltyHolder, royalty);
            _transferring(addresses, values, token.owner, net);
            total += price;

            emit Buy(tokenId, price);
            _transfer(token.owner, sender, tokenId);
            _setTokenPrice(tokenId, token, nextPrices[i]);
        }

        require(msg.value >= total, "not enough ethers");

        uint256 refund;
        if (msg.value > total) {
            refund = msg.value - total;
        }
        for (uint256 i = 0; i < addresses.length; ++i) {
            address to = addresses[i];
            if (to == address(0)) break;
            refund += _transferEthers(to, values[i]);
        }
        if (refund > 0) {
            payable(_msgSender()).transfer(refund);
        }
    }

    function _transferring(
        address[] memory addresses,
        uint256[] memory values,
        address to,
        uint256 value
    ) private pure {
        uint256 idx;
        for (uint256 i = 0 ; i < addresses.length; i++) {
            if (addresses[i] == to) {
                idx = i;
                break;
            }
            if (addresses[i] == address(0)) {
                addresses[i] = to;
                idx = i;
                break;
            }
        }
        values[idx] += value;
    }
}
