'use client';

import { usePathname } from 'next/navigation';
const navigation = [
  ['01', 'Overview', '/'],
  ['02', 'Sensors', '/sensors'],
  ['03', 'Satellite', '#'],
  ['04', 'Comparison', '#'],
  ['05', 'Alerts', '#'],
  ['06', 'Devices', '#'],
  ['07', 'Reports', '#'],
  ['08', 'Settings', '#'],
] as const;

export function AppSidebar() {
  const pathname = usePathname();
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
          {navigation.map(([index, label, href]) => {
            const active =
              href === '/'
                ? pathname === '/'
                : href !== '#' && pathname.startsWith(href);
            return (
              <li key={label}>
                <a
                  className={active ? 'is-active' : undefined}
                  href={href}
                  aria-current={active ? 'page' : undefined}
                >
                  <span>{index}</span>
                  {label}
                  {label === 'Alerts' ? <b>01</b> : null}
                </a>
              </li>
            );
          })}
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
