export interface TocItem {
  title: string;
  pageNumber: number;
  href?: string;
  items?: TocItem[];
}
