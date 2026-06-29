import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { sepolia } from "wagmi/chains";

export const walletConfig = getDefaultConfig({
  appName: "ShieldDrop",
  projectId: import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || "shielddrop-demo",
  chains: [sepolia],
  ssr: false
});
