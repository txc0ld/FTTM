import { cyrb53 } from "./utils";

export const CONTRACT = "0x4f249b2dc6cecbd549a0c354bbfc4919e8c5d3ae";
export const EVADER_CONTRACT = "0x075f90ff6b89a1c164fb352bebd0a16f55804ca2";
export const EVADER = "0x0beed7099af7514ccedf642cfea435731176fb02";

const PROXY = "/api/alchemy";
const PROXY_CORE = "/api/alchemy-core";

function proxyUrl(endpoint, params) {
  const qs = new URLSearchParams({ endpoint });
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") qs.set(k, String(v));
  }
  return `${PROXY}?${qs}`;
}

async function alchemyGet(endpoint, params) {
  const res = await fetch(proxyUrl(endpoint, params));
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json();
}

export function parseMeta(nft) {
  const attrs = {};
  const rawAttrs = nft.raw?.metadata?.attributes || [];
  rawAttrs.forEach((a) => {
    if (a.trait_type) attrs[a.trait_type.toLowerCase()] = a.value;
  });
  const tokenId = nft.tokenId || "0";
  const image =
    nft.image?.cachedUrl ||
    nft.image?.originalUrl ||
    nft.image?.pngUrl ||
    nft.raw?.metadata?.image ||
    "";
  const auditHash = cyrb53(tokenId, 6969);
  const taxHash = cyrb53(tokenId, 4200);

  return {
    id: tokenId,
    name: nft.name || nft.title || `Citizen #${tokenId}`,
    image,
    class: attrs.class || attrs.type || "UNKNOWN",
    insured: (attrs.insured || attrs.insurance || "").toLowerCase(),
    status: attrs.status || "ALIVE",
    background: attrs.background || "",
    headwear: attrs.headwear || attrs.hat || "",
    expression: attrs.expression || attrs.mouth || "",
    eyewear: attrs.eyewear || attrs.eyes || "",
    skin: attrs.skin || "",
    allTraits: attrs,
    inAudit: (auditHash % 100) < 5,
    taxDue: (taxHash % 100) < 12,
  };
}

export function parseEvaderMeta(nft) {
  const attrs = {};
  const rawAttrs = nft.raw?.metadata?.attributes || [];
  rawAttrs.forEach((a) => {
    if (a.trait_type) attrs[a.trait_type.toLowerCase()] = a.value;
  });
  const tokenId = nft.tokenId || "0";
  // Prefer IPFS original over Alchemy CDN for evaders
  const image =
    nft.image?.originalUrl ||
    nft.image?.cachedUrl ||
    nft.image?.pngUrl ||
    nft.raw?.metadata?.image ||
    "";
  const rawMint = nft.mint || {};

  return {
    id: tokenId,
    name: nft.name || nft.title || `Tax Evader #${tokenId}`,
    image,
    class: attrs.class || attrs.type || "UNKNOWN",
    status: attrs.status || "",
    allTraits: attrs,
    mintTimestamp: rawMint.timestamp || null,
    blockNumber: rawMint.blockNumber || null,
    transactionHash: rawMint.transactionHash || null,
    mintAddress: rawMint.mintAddress || null,
  };
}

export async function fetchWalletNFTs(wallet) {
  let allNfts = [];
  let pageKey = null;
  let pages = 0;

  do {
    const params = {
      owner: wallet,
      "contractAddresses[]": CONTRACT,
      withMetadata: "true",
      pageSize: "100",
    };
    if (pageKey) params.pageKey = pageKey;
    const data = await alchemyGet("getNFTsForOwner", params);
    if (data.ownedNfts) allNfts = allNfts.concat(data.ownedNfts);
    pageKey = data.pageKey;
    pages++;
    if (pages >= 5) break;
  } while (pageKey);

  return allNfts.map((nft) => parseMeta(nft));
}

export async function fetchTokenById(tokenId) {
  const data = await alchemyGet("getNFTMetadata", {
    contractAddress: CONTRACT,
    tokenId,
  });
  if (!data.tokenId && !data.id?.tokenId) throw new Error("Token not found");
  return parseMeta(data);
}

export async function fetchWalletEvaders(wallet) {
  let allNfts = [];
  let pageKey = null;
  let pages = 0;

  do {
    const params = {
      owner: wallet,
      "contractAddresses[]": EVADER_CONTRACT,
      withMetadata: "true",
      pageSize: "100",
    };
    if (pageKey) params.pageKey = pageKey;
    const data = await alchemyGet("getNFTsForOwner", params);
    if (data.ownedNfts) allNfts = allNfts.concat(data.ownedNfts);
    pageKey = data.pageKey;
    pages++;
    if (pages >= 5) break;
  } while (pageKey);

  return allNfts.map((nft) => {
    const parsed = parseMeta(nft);
    const ipfsImage =
      nft.image?.originalUrl ||
      (nft.raw?.metadata?.image || "").replace("ipfs://", "https://ipfs.io/ipfs/");
    if (ipfsImage) parsed.image = ipfsImage;
    parsed.isEvader = true;
    return parsed;
  });
}

export async function fetchEvaderById(tokenId) {
  const data = await alchemyGet("getNFTMetadata", {
    contractAddress: EVADER_CONTRACT,
    tokenId,
  });
  if (!data.tokenId && !data.id?.tokenId) throw new Error("Evader not found");
  const parsed = parseMeta(data);
  // Prefer IPFS original over Alchemy CDN — CDN strips backgrounds on grayscale evaders
  const ipfsImage =
    data.image?.originalUrl ||
    (data.raw?.metadata?.image || "").replace(
      "ipfs://",
      "https://ipfs.io/ipfs/"
    );
  if (ipfsImage) parsed.image = ipfsImage;
  return parsed;
}

export async function fetchNFTsForContract(
  contractAddress,
  { withMetadata = true, limit = 100, pageKey, onPage } = {}
) {
  const params = { contractAddress, withMetadata: String(withMetadata), limit: String(limit) };
  if (pageKey) params.pageKey = pageKey;
  const data = await alchemyGet("getNFTsForContract", params);
  if (onPage) onPage(data);
  return data;
}

export async function fetchContractMeta(contractAddress) {
  return alchemyGet("getContractMetadata", { contractAddress });
}

export async function fetchOwnersForContract(contractAddress, { withTokenBalances = true, pageKey } = {}) {
  const params = { contractAddress, withTokenBalances: String(withTokenBalances) };
  if (pageKey) params.pageKey = pageKey;
  return alchemyGet("getOwnersForContract", params);
}

export async function fetchOwnersForNFT(contractAddress, tokenId) {
  return alchemyGet("getOwnersForNFT", { contractAddress, tokenId });
}

export async function reverseENS(address) {
  const res = await fetch(PROXY_CORE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "eth_call",
      params: [
        {
          to: "0x3671aE578E63FdF66ad4F3E12CC0c0d71Ac7510C",
          data:
            "0xbffb691d" +
            "0000000000000000000000000000000000000000000000000000000000000020" +
            "0000000000000000000000000000000000000000000000000000000000000001" +
            "000000000000000000000000" +
            address.slice(2).toLowerCase(),
        },
        "latest",
      ],
    }),
  });
  if (!res.ok) return null;
  const json = await res.json();
  if (!json.result || json.result === "0x") return null;
  try {
    const hex = json.result;
    const strLen = parseInt(hex.slice(130, 194), 16);
    if (!strLen || strLen > 100) return null;
    const nameHex = hex.slice(194, 194 + strLen * 2);
    const name = nameHex
      .match(/.{1,2}/g)
      .map((b) => String.fromCharCode(parseInt(b, 16)))
      .join("");
    return name.endsWith(".eth") ? name : null;
  } catch {
    return null;
  }
}
