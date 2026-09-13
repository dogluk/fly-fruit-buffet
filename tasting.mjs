// Sommelier notes, written by the model rather than by us.
//
// Every line on the tasting card is read off real state: the nose is the
// dish's actual dominant odorants, the palate is the glomeruli those odorants
// actually drive in DoOR, and the score is the mushroom body's own value
// readout. The joke only works because none of it is decoration.
import { ODORANTS } from './config.mjs';
import { DOOR_RESPONSES } from './door_responses.mjs';
import { glomerulusResponse, recipeVector } from './model.mjs';

// House style for compounds a sommelier would never name aloud.
const PROSE = {
  'ethyl acetate': 'nail-polish lift',
  'isopentyl acetate': 'ripe banana',
  'ethyl butyrate': 'pineapple ester',
  'ethanol': 'boozy',
  'acetic acid': 'sharp vinegar',
  '2,3-butanedione': 'buttered lees',
  'hexyl acetate': 'green apple skin',
  '1-hexanol': 'cut grass',
  'benzaldehyde': 'bitter almond',
  'limonene': 'citrus peel',
  'linalool': 'lavender rind',
  'geraniol': 'rose geranium',
};

const APPELLATION = { banana: 'orchard-overripe', cherry: 'cask-fermented', citrus: 'grove-picked' };

export function nose(dish, n = 3) {
  return Object.entries(dish.recipe)
    .sort((a, b) => b[1] - a[1]).slice(0, n)
    .map(([name]) => PROSE[name] ?? name);
}

// Which glomeruli this dish actually lights up, strongest first.
export function palate(dish, n = 2) {
  const g = glomerulusResponse(recipeVector(dish.recipe));
  return Array.from(g.keys())
    .sort((a, b) => g[b] - g[a]).slice(0, n)
    .map(i => DOOR_RESPONSES.glomeruli[i]);
}

// The mushroom body's value readout, on a scale a wine drinker would recognise.
// Deliberately compressed like a real critic's: nobody ever scores below 80.
export function score(value) {
  return Math.max(80, Math.min(100, Math.round(84 + value * 11)));
}

export function finish(learned) {
  if (learned > .30) return 'long, and she remembers it';
  if (learned > .10) return 'lingering';
  if (learned > -.10) return 'short';
  return 'she will not be returning';
}

export function complexity(dish) {
  const n = Object.keys(dish.recipe).length;
  return n >= 7 ? 'layered' : n >= 6 ? 'structured' : 'direct';
}

export const appellation = dish => APPELLATION[dish.id] ?? '';
