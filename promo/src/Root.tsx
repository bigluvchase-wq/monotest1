import { Composition } from "remotion";
import { Promo, PROMO_DURATION } from "./Promo";
import { SHOTS, SHOT_W, SHOT_H } from "./Screens";
import { Still } from "remotion";

// Превью приложения для App Store (iPhone 6.9″/6.7″/6.5″): 886×1920, 30 кадров/с, 15–30 с
export const RemotionRoot: React.FC = () => (
  <>
    <Composition id="AppStorePreview" component={Promo} durationInFrames={PROMO_DURATION} fps={30} width={886} height={1920} />
    {/* Скриншоты для карточки App Store, 1290×2796 */}
    {SHOTS.map((C, i) => (
      <Still key={i} id={`Screenshot${i + 1}`} component={C} width={SHOT_W} height={SHOT_H} />
    ))}
  </>
);
