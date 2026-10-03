import Feed from './Feed';
import Sidebar from './Sidebar';

export default function CommunityHome() {
  return (
    <div className="edu-cm-grid">
      <div className="edu-cm-main">
        <Feed />
      </div>
      <Sidebar />
    </div>
  );
}
