/** Representa uma parte/arquivo de um modelo multi-arquivo do Telegram */
export interface StlPart {
  id: string;
  title: string;
  fileName: string;
  fileSize: string;
  fileSizeBytes: number;
  photos: string[];
}

export interface StlItem {
  id: string;
  title: string;
  imageUrl: string;
  telegramGroupId: string;
  telegramGroupName: string;
  telegramMessageId: number;
  fileSize: string;
  fileSizeBytes?: number;
  addedAt: string;
  photos?: string[];
  downloadCount?: number;
  favoritesCount?: number;
  tags?: string[];
  fileName?: string;
  /** ID do item pai quando este é uma parte de um modelo maior */
  parent_id?: string | null;
  /** Contagem desnormalizada de partes filhas (mantida por trigger no DB) */
  parts_count?: number;
  /** Tipo de impressora */
  printer_type?: string;
  /** Partes filhas carregadas em runtime ao abrir o modal */
  parts?: StlPart[];
}

export const mockStlItems: StlItem[] = [
  {
    id: "1",
    title: "Super Mario Figure - High Detail",
    imageUrl: "",
    telegramGroupId: "-100123456789",
    telegramGroupName: "3D Print Masters",
    telegramMessageId: 1001,
    fileSize: "24 MB",
    addedAt: "2026-06-14T10:00:00Z"
  },
  {
    id: "2",
    title: "Mario Planter",
    imageUrl: "",
    telegramGroupId: "-100987654321",
    telegramGroupName: "Geeky STLs",
    telegramMessageId: 2045,
    fileSize: "12 MB",
    addedAt: "2026-06-13T15:30:00Z"
  },
  {
    id: "3",
    title: "Bowser Castle Dice Tower",
    imageUrl: "",
    telegramGroupId: "-100123456789",
    telegramGroupName: "3D Print Masters",
    telegramMessageId: 1050,
    fileSize: "156 MB",
    addedAt: "2026-06-12T09:15:00Z"
  },
  {
    id: "4",
    title: "Luigi Mansion Keychain",
    imageUrl: "https://images.unsplash.com/photo-1585856488737-2917e3f847d0?w=500&q=80",
    telegramGroupId: "-100555555555",
    telegramGroupName: "Free STL Daily",
    telegramMessageId: 5002,
    fileSize: "3 MB",
    addedAt: "2026-06-10T11:20:00Z"
  },
  {
    id: "5",
    title: "Yoshi Articulated Toy",
    imageUrl: "https://images.unsplash.com/photo-1534080519391-49033320f784?w=500&q=80",
    telegramGroupId: "-100987654321",
    telegramGroupName: "Geeky STLs",
    telegramMessageId: 2100,
    fileSize: "45 MB",
    addedAt: "2026-06-09T18:45:00Z"
  },
  {
    id: "6",
    title: "Mario Kart Trophy",
    imageUrl: "https://images.unsplash.com/photo-1605901309584-818e25960b8f?w=500&q=80",
    telegramGroupId: "-100123456789",
    telegramGroupName: "3D Print Masters",
    telegramMessageId: 1105,
    fileSize: "88 MB",
    addedAt: "2026-06-08T14:10:00Z"
  }
];
