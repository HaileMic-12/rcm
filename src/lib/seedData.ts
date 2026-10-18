import { collection, addDoc } from "firebase/firestore";
import { db } from "./firebase";

const comprehensiveCNSFlashcards = [
  { chapter_id: "cns", front_text: "What does the cribriform plate transmit?", back_text: "The olfactory nerve (CN I).", modality: "Anatomy" },
  { chapter_id: "cns", front_text: "What structure passes through the optic canal?", back_text: "The optic nerve (CN II) and the ophthalmic artery.", modality: "Anatomy" },
  { chapter_id: "cns", front_text: "What are the contents of the Foramen Ovale?", back_text: "Mandibular branch of trigeminal nerve (V3) and the accessory meningeal artery.", modality: "Anatomy" },
  { chapter_id: "cns", front_text: "What passes through the Foramen Rotundum?", back_text: "The maxillary branch of the trigeminal nerve (V2).", modality: "Anatomy" },
  { chapter_id: "cns", front_text: "What does the Foramen Spinosum transmit?", back_text: "The middle meningeal artery.", modality: "Anatomy" },
  { chapter_id: "cns", front_text: "Which structures pass through the Jugular Foramen?", back_text: "Cranial nerves IX (Glossopharyngeal), X (Vagus), XI (Accessory), and the internal jugular vein.", modality: "Anatomy" },
  { chapter_id: "cns", front_text: "What passes through the internal acoustic meatus?", back_text: "Facial nerve (VII), Vestibulocochlear nerve (VIII), and the labyrinthine artery.", modality: "Anatomy" },
  { chapter_id: "cns", front_text: "Which sulcus separates the frontal lobe from the parietal lobe?", back_text: "The central sulcus.", modality: "Axial MRI" },
  { chapter_id: "cns", front_text: "Where is CSF produced?", back_text: "By the choroid plexus located within the ventricular system.", modality: "Physiology" },
  { chapter_id: "cns", front_text: "What connects the third and fourth ventricles?", back_text: "The cerebral aqueduct (Aqueduct of Sylvius).", modality: "Sagittal MRI" },
  { chapter_id: "cns", front_text: "Which arteries supply the anterior circulation of the brain?", back_text: "The paired internal carotid arteries.", modality: "MRA" },
  { chapter_id: "cns", front_text: "What connects the two cerebral hemispheres?", back_text: "The corpus callosum, a thick band of white matter.", modality: "Sagittal MRI" }
];

export const seedFlashcards = async () => {
  try {
    const flashcardsRef = collection(db, "flashcards");
    for (const card of comprehensiveCNSFlashcards) {
      await addDoc(flashcardsRef, card);
    }
    console.log("Comprehensive CNS data seeded successfully!");
  } catch (error) {
    console.error("Error seeding database: ", error);
  }
};