// Kombine human-generation stimuli: 5 association, 5 analogy, 5 blend items.
// Every task takes an arbitrary, recognizable, cross-domain pair (u, v) -- matching the LLM
// benchmark, which samples arbitrary pairs and assesses DISCOVERY (not recognition of known
// analogies/blends). Pairs are remote but tractable; swap freely.
window.STIMULI = [
  // --- association: connect u and v with a chain of true links ---
  { id: "assoc_1", task: "association", u: "Coffee", v: "Jazz" },
  { id: "assoc_2", task: "association", u: "The telephone", v: "The atom" },
  { id: "assoc_3", task: "association", u: "Photosynthesis", v: "The Industrial Revolution" },
  { id: "assoc_4", task: "association", u: "Mount Everest", v: "Chess" },
  { id: "assoc_5", task: "association", u: "DNA", v: "The printing press" },

  // --- analogy: find a shared relational structure between u and v (they stay separate) ---
  { id: "analogy_1", task: "analogy", u: "A glacier", v: "A bureaucracy" },
  { id: "analogy_2", task: "analogy", u: "A vaccine", v: "A rumor" },
  { id: "analogy_3", task: "analogy", u: "A coral reef", v: "A stock market" },
  { id: "analogy_4", task: "analogy", u: "Antibiotic resistance", v: "A spam filter" },
  { id: "analogy_5", task: "analogy", u: "A river delta", v: "A family tree" },

  // --- blending: FUSE u and v into one new concept with its own emergent structure ---
  { id: "blend_1", task: "blending", u: "Democracy", v: "Banking" },
  { id: "blend_2", task: "blending", u: "Gardening", v: "Software" },
  { id: "blend_3", task: "blending", u: "A courtroom", v: "A kitchen" },
  { id: "blend_4", task: "blending", u: "Cartography", v: "Memory" },
  { id: "blend_5", task: "blending", u: "An orchestra", v: "A city" }
];

window.EXPERIMENT_CONFIG = {
  experiment_name: "kombine_generation",
  tasks: ["association", "analogy", "blending"],
  n_per_task: 5,
  totalStimuli: window.STIMULI.length,
  consent_version: "kombine_gen_v2_2026-08"  // v2: blend = two-entity fusion (was polysemy)
};
