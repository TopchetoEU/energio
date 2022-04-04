import { gameObjectManager } from "./gameObject";
import { planet } from "./planet";
import { player } from "./player";
import { objectChangeTracker, trackableObject } from "./props/changes";
import { translators } from "./props/translator";

export const playerTranslator = translators<player, string>()
    .from(v => gameObjectManager.getTyped(v, player))
    .to(v => v.id);
export const planetTranslator = translators<planet, string>()
    .from(v => gameObjectManager.getTyped(v, planet))
    .to(v => v.id);
