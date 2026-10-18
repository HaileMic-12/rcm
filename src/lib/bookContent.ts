export interface Subsection {
  id: string;
  title: string;
  content: string; // We can use HTML strings or React components here
}

export interface Section {
  id: string;
  title: string;
  subsections: Subsection[];
}

export const bookContent: Record<string, Section> = {
  "cns": {
    id: "cns",
    title: "Section 1 - Central Nervous System",
    subsections: [
      {
        id: "cns-1",
        title: "1. The Skull and Meninges",
        content: `
          <h3 class="text-2xl font-bold text-white mb-4">The Skull Base</h3>
          <p class="mb-4 text-neutral-300 leading-relaxed">The skull base acts as a transition zone between the brain and the extracranial head and neck. It is pierced by numerous foramina that transmit cranial nerves and major blood vessels. The anterior cranial fossa contains the cribriform plate (transmitting CN I). The middle cranial fossa contains the optic canal, superior orbital fissure, foramen rotundum, foramen ovale, and foramen spinosum.</p>
          <div class="bg-neutral-800/50 p-5 rounded-xl border-l-4 border-emerald-500 my-6">
            <h4 class="text-emerald-400 font-semibold mb-2">High-Yield Foramina</h4>
            <ul class="list-disc pl-5 space-y-2 text-sm text-neutral-300">
              <li><strong>Foramen Rotundum:</strong> Maxillary nerve (CN V2)</li>
              <li><strong>Foramen Ovale:</strong> Mandibular nerve (CN V3), accessory meningeal artery</li>
              <li><strong>Foramen Spinosum:</strong> Middle meningeal artery</li>
            </ul>
          </div>
        `
      },
      {
        id: "cns-2",
        title: "2. The Brain and Ventricles",
        content: `
          <h3 class="text-2xl font-bold text-white mb-4">Cerebral Hemispheres</h3>
          <p class="mb-4 text-neutral-300 leading-relaxed">The brain is divided into two cerebral hemispheres by the longitudinal fissure, which contains the falx cerebri. The central sulcus separates the frontal lobe (motor) from the parietal lobe (sensory). The Sylvian fissure separates the temporal lobe inferiorly from the frontal and parietal lobes superiorly.</p>
          <p class="text-neutral-300 leading-relaxed">The ventricular system comprises the lateral ventricles, third ventricle, cerebral aqueduct, and fourth ventricle. CSF is produced by the choroid plexus and flows into the subarachnoid space.</p>
        `
      },
      {
        id: "cns-3",
        title: "3. Cerebrovascular Anatomy",
        content: `
          <h3 class="text-2xl font-bold text-white mb-4">The Circle of Willis</h3>
          <p class="mb-4 text-neutral-300 leading-relaxed">The brain receives its arterial supply from the paired internal carotid arteries (anterior circulation) and the paired vertebral arteries (posterior circulation). These anastomose at the base of the brain to form the Circle of Willis.</p>
        `
      }
    ]
  },
  "thorax-abdomen-pelvis": {
    id: "thorax-abdomen-pelvis",
    title: "Section 2 - Thorax, Abdomen & Pelvis",
    subsections: [
      { id: "tap-1", title: "1. The Thoracic Wall and Pleura", content: "<p class='text-neutral-300'>Content pending extraction from PDF...</p>" },
      { id: "tap-2", title: "2. The Mediastinum and Heart", content: "<p class='text-neutral-300'>Content pending extraction from PDF...</p>" }
    ]
  }
  // Limbs and Obstetrics will follow the exact same pattern
};