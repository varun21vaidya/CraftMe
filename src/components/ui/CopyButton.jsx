import { useToast } from './Toast';

/** Copies `text`; says so in a toast, or tells the reader to copy by hand when the browser refuses. */
export function CopyButton({ text, label = 'Copy' }) {
  const toast = useToast();
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      toast(`Copied ${text}`);
    } catch {
      toast(`Press Ctrl+C to copy ${text}`, { kind: 'err' });
    }
  };
  return <button type="button" className="btn btn-ghost btn-sm" onClick={copy}>{label}</button>;
}
