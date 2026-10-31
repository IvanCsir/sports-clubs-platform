import { useState } from 'react';
import { Download } from 'lucide-react';
import { fetchClubDataset } from '../api';

function safeFilePart(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'club';
}

export default function SeasonBackupPanel({ club, token }) {
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const season = club.season?.name || String(new Date().getFullYear());

  async function downloadBackup() {
    setDownloading(true);
    setError('');
    setSuccess('');
    try {
      const payload = await fetchClubDataset(club.slug, 'backup', { token, fallbackError: 'No se pudo crear el respaldo.' });

      const blob = new Blob([`${JSON.stringify(payload, null, 2)}\n`], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `respaldo-${safeFilePart(club.slug)}-temporada-${safeFilePart(season)}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setSuccess('El respaldo de la temporada se descargó correctamente.');
    } catch (downloadError) {
      setError(downloadError.message || 'No se pudo descargar el respaldo.');
    } finally {
      setDownloading(false);
    }
  }

  return (
    <section className="physical-card season-backup-card">
      <div className="section-heading">
        <div>
          <h2>Respaldo de temporada {season}</h2>
          <p>Descargá una copia de los datos deportivos guardados para esta temporada.</p>
        </div>
      </div>
      <div className="season-backup-content">
        <ul>
          <li>Plantel y categorías</li>
          <li>Citaciones y partidos de la temporada</li>
          <li>Planes de partido, incluidas jugadas y enlaces de video</li>
          <li>Catálogo de pruebas, evaluaciones físicas y seguimiento de jugadoras</li>
          <li>Eventos de la botonera, organizados por torneo</li>
        </ul>
        <p className="season-backup-note">
          Se genera un archivo JSON descargable. Incluye Apertura y Clausura si tienen datos en esta temporada; no incluye otras temporadas ni credenciales.
        </p>
        {error && <p className="message error" role="alert">{error}</p>}
        {success && <p className="season-backup-success" role="status">{success}</p>}
        <button type="button" onClick={downloadBackup} disabled={downloading || !token}>
          <Download size={18} aria-hidden="true" />
          {downloading ? 'Preparando respaldo…' : 'Descargar respaldo de temporada'}
        </button>
      </div>
    </section>
  );
}
