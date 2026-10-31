import { Send } from 'lucide-react';

// Entrada a la precarga en AMH: el flujo vive en PrecargaModal; esta sección solo lo abre.
export default function PrecargaPanel({ onOpen }) {
  return (
    <section className="physical-card precarga-panel">
      <div className="section-heading">
        <div>
          <h2>Precarga AMH</h2>
          <p>Inscribí a las jugadoras citadas en el partido oficial de AMH.</p>
        </div>
      </div>
      <ol className="precarga-steps">
        <li>Elegí el partido oficial.</li>
        <li>Tildá las jugadoras citadas que querés inscribir.</li>
        <li>Enviá la precarga.</li>
      </ol>
      <button type="button" onClick={onOpen}>
        <Send size={18} aria-hidden="true" /> Abrir precarga
      </button>
    </section>
  );
}
