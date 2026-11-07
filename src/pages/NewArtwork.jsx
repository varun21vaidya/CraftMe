import { useNavigate } from 'react-router-dom';
import { ArtworkUploadForm } from '../components/dashboard/ArtworkUploadForm';

export default function NewArtwork() {
  const navigate = useNavigate();
  return (
    <main className="wrap page" style={{ maxWidth: 640 }}>
      <div className="page-head"><div><h1>Add an artwork</h1></div></div>
      <div className="panel"><ArtworkUploadForm onSaved={() => navigate('/dashboard/orders')} /></div>
    </main>
  );
}
