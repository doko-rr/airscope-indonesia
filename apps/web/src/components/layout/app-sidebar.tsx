const navigation = [
  ['01', 'Overview'],
  ['02', 'Live Map'],
  ['03', 'Sensors'],
  ['04', 'Satellite'],
  ['05', 'Comparison'],
  ['06', 'Alerts'],
  ['07', 'Devices'],
  ['08', 'Reports'],
  ['09', 'Settings'],
] as const;

export function AppSidebar() {
  return (
    <aside className="shell-sidebar">
      <div className="brand-block">
        <span className="brand-marker" aria-hidden="true" />
        <div>
          <strong>AIRSCOPE</strong>
          <span>Environmental intelligence</span>
        </div>
      </div>

      <p className="rail-label">Observation rail</p>

      <nav aria-label="Primary navigation">
        <ul className="rail-navigation">
          {navigation.map(([index, label], itemIndex) => (
            <li key={label}>
              <a
                className={itemIndex === 0 ? 'is-active' : undefined}
                href={itemIndex === 0 ? '/' : '#'}
                aria-current={itemIndex === 0 ? 'page' : undefined}
              >
                <span>{index}</span>
                {label}
                {label === 'Alerts' ? <b>01</b> : null}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <div className="rail-status">
        <p>
          Ground network <strong>6 / 6 reporting</strong>
        </p>
        <p>
          Satellite <span>Not connected</span>
        </p>
        <p>
          System status <span>Simulation AIRSIM-V1</span>
        </p>
      </div>
    </aside>
  );
}
