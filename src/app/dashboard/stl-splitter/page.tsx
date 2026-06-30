import { Metadata } from 'next';
import { STLSplitterClient } from './STLSplitterClient';

export const metadata: Metadata = {
  title: 'STL Splitter | LB Creative Studio',
  description: 'Split multi-part STL files interactively. Paint faces and export as 3MF.',
};

export default function STLSplitterPage() {
  return <STLSplitterClient />;
}
