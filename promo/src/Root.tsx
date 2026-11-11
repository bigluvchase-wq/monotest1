import { Composition } from "remotion";
import { Promo, PROMO_DURATION } from "./Promo";

// Превью приложения для App Store (iPhone 6.9″/6.7″/6.5″): 886×1920, 30 кадров/с, 15–30 с
export const RemotionRoot: React.FC = () => (
  <Composition id="AppStorePreview" component={Promo} durationInFrames={PROMO_DURATION} fps={30} width={886} height={1920} />
);
