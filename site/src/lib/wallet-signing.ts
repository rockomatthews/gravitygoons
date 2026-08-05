import { stringToHex, type Hex } from "viem";

export function personalSignParams(message: string, address: `0x${string}`): [Hex, `0x${string}`] {
  return [stringToHex(message), address];
}
