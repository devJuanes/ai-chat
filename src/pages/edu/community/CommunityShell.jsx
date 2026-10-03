import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { useEduPulse } from '../pulse';
import { CommunityProvider, useCommunity } from './CommunityContext';
import CommunityNav from './CommunityNav';
import ComposeDialog from './ComposeDialog';
import Icon from './icons';

function CommunityFrame() {
  const { openCompose, notice, setNotice } = useCommunity();
  const pulse = useEduPulse();
  const [menu, setMenu] = useState(false);
  const create = (kind) => {
    setMenu(false);
    openCompose(kind);
  };

  return (
    <div className="edu-home">
      <div className="edu-community">
        <header className="edu-cm-head">
          <div className="edu-cm-brand">
            <span className="edu-cm-mark" aria-hidden="true">
              <Icon name="people" />
            </span>
            <div>
              <h1>Comunidad</h1>
              <p>Pregunta, muestra lo que construyes y ayuda a quien va en la misma ruta.</p>
            </div>
          </div>
          <div className="edu-cm-create">
            <button type="button" className="edu-btn edu-cm-publish" onClick={() => setMenu((value) => !value)}>
              <Icon name="pencil" />
              Crear
            </button>
            {menu ? (
              <div className="edu-cm-create-menu" role="menu">
                <button type="button" onClick={() => create('hilo')}>Hilo</button>
                <button type="button" onClick={() => create('challenge')}>Reto</button>
                <button type="button" onClick={() => create('project')}>Proyecto</button>
                <button type="button" onClick={() => create('group')}>Grupo</button>
                {pulse.admin ? (
                  <button type="button" onClick={() => create('event')}>Evento</button>
                ) : null}
              </div>
            ) : null}
          </div>
        </header>
        <CommunityNav />
        {notice ? (
          <div className="edu-cm-notice" role="status">
            <span>{notice}</span>
            <button type="button" onClick={() => setNotice('')}>
              Cerrar
            </button>
          </div>
        ) : null}
        <Outlet />
      </div>
      <ComposeDialog />
    </div>
  );
}

export default function CommunityShell() {
  return (
    <CommunityProvider>
      <CommunityFrame />
    </CommunityProvider>
  );
}
