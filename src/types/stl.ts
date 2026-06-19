export interface StlItem {
  id: string;
  title: string;
  imageUrl: string;
  telegramGroupId: string;
  telegramGroupName: string;
  telegramMessageId: number;
  fileSize: string;
  addedAt: string;
  photos?: string[];
  downloadCount?: number;
  favoritesCount?: number;
  tags?: string[];
  fileName?: string;
  description?: string;
  printer_type?: string;
}
