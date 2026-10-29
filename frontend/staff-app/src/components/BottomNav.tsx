import React from 'react';

interface Props {
  activeTab: string;
  onNavigate: (tab: string) => void;
}

const tabs = [
  { id: 'home', label: 'Home', icon: 'home-outline', iconActive: 'home' },
  { id: 'calendar', label: 'Calendar', icon: 'calendar-outline', iconActive: 'calendar' },
  { id: 'payroll', label: 'Payroll', icon: 'wallet-outline', iconActive: 'wallet' },
  { id: 'profile', label: 'Profile', icon: 'person-outline', iconActive: 'person' },
];

export default function BottomNav({ activeTab, onNavigate }: Props) {
  return (
    <nav className="bottom-nav">
      {tabs.map((tab) => (
        <div
          key={tab.id}
          className={`tab-item ${activeTab === tab.id ? 'active' : ''}`}
          onClick={() => onNavigate(tab.id)}
        >
          <ion-icon className="tab-icon" name={activeTab === tab.id ? tab.iconActive : tab.icon} />
          <span className="tab-label">{tab.label}</span>
        </div>
      ))}
    </nav>
  );
}
