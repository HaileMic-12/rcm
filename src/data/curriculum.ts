export interface ChapterCurriculum {
  id: string;
  number: number;
  title: string;
  part: string;
  sections: string[];
}

export const RADIOLOGY_CURRICULUM: ChapterCurriculum[] = [
  {
    id: "Chapter 1",
    number: 1,
    title: "The skull and brain",
    part: "Section 1 - Central Nervous System",
    sections: [
      "Introduction and imaging methods",
      "Osteology of the skull",
      "The skull radiograph",
      "The cerebral envelope",
      "Meningeal blood supply and innervation",
      "The subarachnoid cisterns",
      "The brainstem and cranial nerves",
      "The cerebellum",
      "The intracranial circulation",
      "The dural venous sinuses",
      "The supratentorial venous system",
      "The vertebrobasilar arterial system",
      "Diencephalon",
      "The pituitary gland",
      "The basal ganglia",
      "The limbic system",
      "The cerebral hemispheres",
      "White matter tracts",
      "The ventricular system"
    ]
  },
  {
    id: "Chapter 2",
    number: 2,
    title: "The orbit and visual pathway",
    part: "Section 1 - Central Nervous System",
    sections: [
      "Plain film and cross-sectional anatomy",
      "The orbit and orbital foramina",
      "The orbital compartments and globe",
      "The extra-ocular muscles and lacrimal apparatus",
      "The optic nerve",
      "Intracranial visual pathways",
      "Vascular anatomy"
    ]
  },
  {
    id: "Chapter 3",
    number: 3,
    title: "The petrous temporal bone",
    part: "Section 1 - Central Nervous System",
    sections: [
      "External auditory canal and tympanic membrane",
      "The middle ear and mastoid",
      "The auditory ossicles and Prussak's space",
      "The inner ear and cochlea",
      "The vestibule and semicircular canals",
      "The internal auditory canal",
      "The facial (VIIth cranial) nerve",
      "The jugular foramen"
    ]
  },
  {
    id: "Chapter 4",
    number: 4,
    title: "The extracranial head and neck",
    part: "Section 1 - Central Nervous System",
    sections: [
      "The suprahyoid neck and parapharyngeal space",
      "The salivary glands (Parotid, Submandibular, Sublingual)",
      "The pharynx (Nasopharynx, Oropharynx, Hypopharynx)",
      "The larynx and retropharyngeal space",
      "The mandible, masticator space, and TMJ",
      "The cervical arteries and venous drainage",
      "The paranasal sinuses and nasal cavity",
      "Pterygopalatine fossa, oral cavity, and tongue",
      "Thyroid, parathyroid, and cervical lymphatic system"
    ]
  },
  {
    id: "Chapter 5",
    number: 5,
    title: "The vertebral column and spinal cord",
    part: "Section 1 - Central Nervous System",
    sections: [
      "Radiographic anatomy and vertebral column",
      "The cranio-cervical junction",
      "Cervical, thoracic, and lumbar vertebrae",
      "The spinal canal, sacrum, and coccyx",
      "CT anatomy (Atlas, facet, and costovertebral joints)",
      "MRI anatomy (Vertebral body, discs, and ligaments)",
      "The spinal cord, nerves, and venous plexuses",
      "Sacroiliac joints, paraspinal muscles, brachial & lumbosacral plexus"
    ]
  },
  {
    id: "Chapter 6",
    number: 6,
    title: "The chest",
    part: "Section 2 - Thorax, Abdomen and Pelvis",
    sections: [
      "Plain radiography and cross-sectional imaging",
      "Bony thorax, chest wall, and diaphragm",
      "Airways (Trachea, bronchi, and lobar anatomy)",
      "Pulmonary vessels and hilum",
      "Pleura and fissures",
      "Mediastinum, thymus, and lymph nodes"
    ]
  },
  {
    id: "Chapter 7",
    number: 7,
    title: "The heart and great vessels",
    part: "Section 2 - Thorax, Abdomen and Pelvis",
    sections: [
      "Embryology and aortic arch derivatives",
      "Layers of the heart",
      "Pericardium and pericardial recesses",
      "Cardiac chambers and valves",
      "Coronary arterial and venous anatomy",
      "Great vessels"
    ]
  },
  {
    id: "Chapter 8",
    number: 8,
    title: "The breast",
    part: "Section 2 - Thorax, Abdomen and Pelvis",
    sections: [
      "Imaging methods and mammography positioning",
      "Normal breast anatomy and TDLU",
      "Vascular supply and lymphatic drainage",
      "Ultrasound and MRI breast anatomy",
      "Benign vs malignant imaging features and interventions"
    ]
  },
  {
    id: "Chapter 9",
    number: 9,
    title: "The anterior abdominal wall and peritoneum",
    part: "Section 2 - Thorax, Abdomen and Pelvis",
    sections: [
      "Anterior abdominal wall anatomy and rectus sheath",
      "Inguinal region and abdominal wall hernias",
      "Peritoneal cavity, reflections, and ligaments",
      "Subphrenic spaces, lesser sac, and paracolic gutters",
      "Retroperitoneal spaces and pelvic peritoneum"
    ]
  },
  {
    id: "Chapter 10",
    number: 10,
    title: "The abdomen and retroperitoneum",
    part: "Section 2 - Thorax, Abdomen and Pelvis",
    sections: [
      "Liver segments (Couinaud) and hepatic veins",
      "Biliary system and gallbladder",
      "Pancreatic and splenic anatomy",
      "Portal venous system",
      "Retroperitoneal vasculature and lymphatics"
    ]
  },
  {
    id: "Chapter 11",
    number: 11,
    title: "The gastrointestinal tract",
    part: "Section 2 - Thorax, Abdomen and Pelvis",
    sections: [
      "Esophagus and stomach",
      "Duodenum and small bowel (Jejunum and Ileum)",
      "Large bowel (Colon, teniae coli, appendix)",
      "Rectum and anal canal",
      "GI vascular supply and enterography"
    ]
  },
  {
    id: "Chapter 12",
    number: 12,
    title: "The kidney and adrenal gland",
    part: "Section 2 - Thorax, Abdomen and Pelvis",
    sections: [
      "Kidney anatomy, renal fascia, and sinus",
      "Renal vasculature and ureters",
      "Congenital renal variants (Horseshoe, Duplex)",
      "Adrenal gland anatomy and imaging characteristics"
    ]
  },
  {
    id: "Chapter 13",
    number: 13,
    title: "The male pelvis",
    part: "Section 2 - Thorax, Abdomen and Pelvis",
    sections: [
      "Prostate zones (McNeal) and capsule",
      "Seminal vesicles and male urethra",
      "Urinary bladder and pelvic floor muscles",
      "Testicular, scrotal, and penile anatomy"
    ]
  },
  {
    id: "Chapter 14",
    number: 14,
    title: "The female pelvis",
    part: "Section 2 - Thorax, Abdomen and Pelvis",
    sections: [
      "Uterus anatomy, layers, and junctional zone",
      "Adnexa, ovaries, and fallopian tubes",
      "Broad ligament, pelvic support, and ureter relations",
      "Vagina, fornices, and pouch of Douglas"
    ]
  },
  {
    id: "Chapter 15",
    number: 15,
    title: "The upper limb",
    part: "Section 2 - Thorax, Abdomen and Pelvis",
    sections: [
      "Shoulder girdle and glenohumeral joint",
      "Arm, elbow, and forearm anatomy",
      "Wrist and hand bones, ligaments, and tendons",
      "Vascular and nerve supply of the upper limb"
    ]
  },
  {
    id: "Chapter 16",
    number: 16,
    title: "The lower limb",
    part: "Section 2 - Thorax, Abdomen and Pelvis",
    sections: [
      "Pelvic girdle, hip joint, and proximal femur",
      "Thigh, knee joint, and menisci",
      "Leg, ankle, and foot anatomy",
      "Vascular and nerve supply of the lower limb"
    ]
  },
  {
    id: "Chapter 17",
    number: 17,
    title: "Obstetrical imaging",
    part: "Section 2 - Thorax, Abdomen and Pelvis",
    sections: [
      "First trimester ultrasound and dating",
      "Fetal biometry and anatomy survey",
      "Placenta, umbilical cord, and amniotic fluid",
      "Fetal Doppler and well-being assessment"
    ]
  }
];