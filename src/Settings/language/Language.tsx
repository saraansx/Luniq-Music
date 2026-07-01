import React, { useState, useRef, useEffect } from 'react';
import './Language.css';
import { useLanguage } from '../../context/LanguageContext';

interface DropdownProps {
    label: string;
    subLabel: string;
    options: { value: string; label: string }[];
    value: string;
    onChange: (value: string) => void;
}

const CustomDropdown: React.FC<DropdownProps> = ({ label, subLabel, options, value, onChange }) => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const selectedOption = options.find(opt => opt.value === value);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div 
            className="settings-row custom-dropdown-container" 
            ref={dropdownRef}
            style={{ position: 'relative', zIndex: isOpen ? 'var(--z-float)' : 'var(--z-base)' }}
        >
            <div className="row-info">
                <span className="row-label">{label}</span>
                <span className="row-sub">{subLabel}</span>
            </div>
            <div className="dropdown-wrapper">
                <button 
                    className={`dropdown-trigger ${isOpen ? 'active' : ''}`}
                    onClick={() => setIsOpen(!isOpen)}
                >
                    <span>{selectedOption?.label}</span>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={`chevron ${isOpen ? 'up' : ''}`}>
                        <polyline points="6 9 12 15 18 9"></polyline>
                    </svg>
                </button>
                {isOpen && (
                    <div className="dropdown-menu">
                        {options.map(option => (
                            <div 
                                key={option.value}
                                className={`dropdown-item ${option.value === value ? 'selected' : ''}`}
                                onClick={() => {
                                    onChange(option.value);
                                    setIsOpen(false);
                                }}
                            >
                                {option.label}
                                {option.value === value && (
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                        <polyline points="20 6 9 17 4 12"></polyline>
                                    </svg>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

const Language: React.FC = () => {
    const { language, setLanguage, t } = useLanguage();
    const [region, setRegion] = useState('US');

    useEffect(() => {
        const loadSettings = async () => {
            const savedRegion = await window.ipcRenderer?.invoke('get-setting', 'region');
            if (savedRegion) setRegion(savedRegion);
        };
        loadSettings();
    }, []);

    const handleLanguageChange = async (val: string) => {
        setLanguage(val);
    };

    const handleRegionChange = async (val: string) => {
        setRegion(val);
        await window.ipcRenderer?.invoke('set-setting', 'region', val);
    };

    const languageOptions = [
        { value: 'en', label: 'English' },
        { value: 'es', label: 'Español' },
        { value: 'fr', label: 'Français' },
        { value: 'de', label: 'Deutsch' },
        { value: 'ja', label: '日本語' },
        { value: 'pt', label: 'Português' },
        { value: 'it', label: 'Italiano' },
        { value: 'ko', label: '한국어' },
        { value: 'zh', label: '中文' },
        { value: 'ru', label: 'Русский' },
        { value: 'ar', label: 'العربية' },
        { value: 'hi', label: 'हिन्दी' },
        { value: 'tr', label: 'Türkçe' },
        { value: 'pl', label: 'Polski' },
        { value: 'nl', label: 'Nederlands' },
        { value: 'sv', label: 'Svenska' },
        { value: 'th', label: 'ไทย' },
        { value: 'vi', label: 'Tiếng Việt' },
        { value: 'id', label: 'Bahasa Indonesia' },
        { value: 'uk', label: 'Українська' },
        { value: 'ta', label: 'தமிழ்' },
    ];

    const regionOptions = [
        { value: 'AL', label: 'Albania' },
        { value: 'DZ', label: 'Algeria' },
        { value: 'AD', label: 'Andorra' },
        { value: 'AO', label: 'Angola' },
        { value: 'AG', label: 'Antigua and Barbuda' },
        { value: 'AR', label: 'Argentina' },
        { value: 'AM', label: 'Armenia' },
        { value: 'AU', label: 'Australia' },
        { value: 'AT', label: 'Austria' },
        { value: 'AZ', label: 'Azerbaijan' },
        { value: 'BS', label: 'Bahamas' },
        { value: 'BH', label: 'Bahrain' },
        { value: 'BD', label: 'Bangladesh' },
        { value: 'BB', label: 'Barbados' },
        { value: 'BY', label: 'Belarus' },
        { value: 'BE', label: 'Belgium' },
        { value: 'BZ', label: 'Belize' },
        { value: 'BJ', label: 'Benin' },
        { value: 'BT', label: 'Bhutan' },
        { value: 'BO', label: 'Bolivia' },
        { value: 'BA', label: 'Bosnia and Herzegovina' },
        { value: 'BW', label: 'Botswana' },
        { value: 'BR', label: 'Brazil' },
        { value: 'BN', label: 'Brunei' },
        { value: 'BG', label: 'Bulgaria' },
        { value: 'BF', label: 'Burkina Faso' },
        { value: 'BI', label: 'Burundi' },
        { value: 'CV', label: 'Cabo Verde' },
        { value: 'KH', label: 'Cambodia' },
        { value: 'CM', label: 'Cameroon' },
        { value: 'CA', label: 'Canada' },
        { value: 'TD', label: 'Chad' },
        { value: 'CL', label: 'Chile' },
        { value: 'CO', label: 'Colombia' },
        { value: 'KM', label: 'Comoros' },
        { value: 'CG', label: 'Congo' },
        { value: 'CD', label: 'Congo (DRC)' },
        { value: 'CR', label: 'Costa Rica' },
        { value: 'HR', label: 'Croatia' },
        { value: 'CW', label: 'Curaçao' },
        { value: 'CY', label: 'Cyprus' },
        { value: 'CZ', label: 'Czech Republic' },
        { value: 'DK', label: 'Denmark' },
        { value: 'DJ', label: 'Djibouti' },
        { value: 'DM', label: 'Dominica' },
        { value: 'DO', label: 'Dominican Republic' },
        { value: 'EC', label: 'Ecuador' },
        { value: 'EG', label: 'Egypt' },
        { value: 'SV', label: 'El Salvador' },
        { value: 'GQ', label: 'Equatorial Guinea' },
        { value: 'EE', label: 'Estonia' },
        { value: 'SZ', label: 'Eswatini' },
        { value: 'ET', label: 'Ethiopia' },
        { value: 'FJ', label: 'Fiji' },
        { value: 'FI', label: 'Finland' },
        { value: 'FR', label: 'France' },
        { value: 'GA', label: 'Gabon' },
        { value: 'GM', label: 'Gambia' },
        { value: 'GE', label: 'Georgia' },
        { value: 'DE', label: 'Germany' },
        { value: 'GH', label: 'Ghana' },
        { value: 'GR', label: 'Greece' },
        { value: 'GD', label: 'Grenada' },
        { value: 'GT', label: 'Guatemala' },
        { value: 'GN', label: 'Guinea' },
        { value: 'GW', label: 'Guinea-Bissau' },
        { value: 'GY', label: 'Guyana' },
        { value: 'HT', label: 'Haiti' },
        { value: 'HN', label: 'Honduras' },
        { value: 'HK', label: 'Hong Kong' },
        { value: 'HU', label: 'Hungary' },
        { value: 'IS', label: 'Iceland' },
        { value: 'IN', label: 'India' },
        { value: 'ID', label: 'Indonesia' },
        { value: 'IQ', label: 'Iraq' },
        { value: 'IE', label: 'Ireland' },
        { value: 'IL', label: 'Israel' },
        { value: 'IT', label: 'Italy' },
        { value: 'CI', label: 'Ivory Coast' },
        { value: 'JM', label: 'Jamaica' },
        { value: 'JP', label: 'Japan' },
        { value: 'JO', label: 'Jordan' },
        { value: 'KZ', label: 'Kazakhstan' },
        { value: 'KE', label: 'Kenya' },
        { value: 'KI', label: 'Kiribati' },
        { value: 'KR', label: 'South Korea' },
        { value: 'KW', label: 'Kuwait' },
        { value: 'KG', label: 'Kyrgyzstan' },
        { value: 'LA', label: 'Laos' },
        { value: 'LV', label: 'Latvia' },
        { value: 'LB', label: 'Lebanon' },
        { value: 'LS', label: 'Lesotho' },
        { value: 'LR', label: 'Liberia' },
        { value: 'LY', label: 'Libya' },
        { value: 'LI', label: 'Liechtenstein' },
        { value: 'LT', label: 'Lithuania' },
        { value: 'LU', label: 'Luxembourg' },
        { value: 'MO', label: 'Macau' },
        { value: 'MG', label: 'Madagascar' },
        { value: 'MW', label: 'Malawi' },
        { value: 'MY', label: 'Malaysia' },
        { value: 'MV', label: 'Maldives' },
        { value: 'ML', label: 'Mali' },
        { value: 'MT', label: 'Malta' },
        { value: 'MH', label: 'Marshall Islands' },
        { value: 'MR', label: 'Mauritania' },
        { value: 'MU', label: 'Mauritius' },
        { value: 'MX', label: 'Mexico' },
        { value: 'FM', label: 'Micronesia' },
        { value: 'MD', label: 'Moldova' },
        { value: 'MC', label: 'Monaco' },
        { value: 'MN', label: 'Mongolia' },
        { value: 'ME', label: 'Montenegro' },
        { value: 'MA', label: 'Morocco' },
        { value: 'MZ', label: 'Mozambique' },
        { value: 'NA', label: 'Namibia' },
        { value: 'NR', label: 'Nauru' },
        { value: 'NP', label: 'Nepal' },
        { value: 'NL', label: 'Netherlands' },
        { value: 'NZ', label: 'New Zealand' },
        { value: 'NI', label: 'Nicaragua' },
        { value: 'NE', label: 'Niger' },
        { value: 'NG', label: 'Nigeria' },
        { value: 'MK', label: 'North Macedonia' },
        { value: 'NO', label: 'Norway' },
        { value: 'OM', label: 'Oman' },
        { value: 'PK', label: 'Pakistan' },
        { value: 'PW', label: 'Palau' },
        { value: 'PS', label: 'Palestine' },
        { value: 'PA', label: 'Panama' },
        { value: 'PG', label: 'Papua New Guinea' },
        { value: 'PY', label: 'Paraguay' },
        { value: 'PE', label: 'Peru' },
        { value: 'PH', label: 'Philippines' },
        { value: 'PL', label: 'Poland' },
        { value: 'PT', label: 'Portugal' },
        { value: 'QA', label: 'Qatar' },
        { value: 'RO', label: 'Romania' },
        { value: 'RU', label: 'Russia' },
        { value: 'RW', label: 'Rwanda' },
        { value: 'WS', label: 'Samoa' },
        { value: 'SM', label: 'San Marino' },
        { value: 'ST', label: 'São Tomé and Príncipe' },
        { value: 'SA', label: 'Saudi Arabia' },
        { value: 'SN', label: 'Senegal' },
        { value: 'RS', label: 'Serbia' },
        { value: 'SC', label: 'Seychelles' },
        { value: 'SL', label: 'Sierra Leone' },
        { value: 'SG', label: 'Singapore' },
        { value: 'SK', label: 'Slovakia' },
        { value: 'SI', label: 'Slovenia' },
        { value: 'SB', label: 'Solomon Islands' },
        { value: 'ZA', label: 'South Africa' },
        { value: 'ES', label: 'Spain' },
        { value: 'LK', label: 'Sri Lanka' },
        { value: 'KN', label: 'St. Kitts and Nevis' },
        { value: 'LC', label: 'St. Lucia' },
        { value: 'VC', label: 'St. Vincent & Grenadines' },
        { value: 'SR', label: 'Suriname' },
        { value: 'SE', label: 'Sweden' },
        { value: 'CH', label: 'Switzerland' },
        { value: 'TW', label: 'Taiwan' },
        { value: 'TJ', label: 'Tajikistan' },
        { value: 'TZ', label: 'Tanzania' },
        { value: 'TH', label: 'Thailand' },
        { value: 'TL', label: 'Timor-Leste' },
        { value: 'TG', label: 'Togo' },
        { value: 'TO', label: 'Tonga' },
        { value: 'TT', label: 'Trinidad and Tobago' },
        { value: 'TN', label: 'Tunisia' },
        { value: 'TR', label: 'Turkey' },
        { value: 'TV', label: 'Tuvalu' },
        { value: 'UG', label: 'Uganda' },
        { value: 'UA', label: 'Ukraine' },
        { value: 'AE', label: 'United Arab Emirates' },
        { value: 'GB', label: 'United Kingdom' },
        { value: 'US', label: 'United States' },
        { value: 'UY', label: 'Uruguay' },
        { value: 'UZ', label: 'Uzbekistan' },
        { value: 'VU', label: 'Vanuatu' },
        { value: 'VE', label: 'Venezuela' },
        { value: 'VN', label: 'Vietnam' },
        { value: 'ZM', label: 'Zambia' },
        { value: 'ZW', label: 'Zimbabwe' },
    ];

    return (
        <div className="settings-language-card" style={{ position: 'relative' }}>
            <div className="settings-account-header">
                <h2 className="settings-account-title">{t('langRegion.title')}</h2>
                <p className="settings-account-description">{t('langRegion.sub')}</p>
            </div>

            <div className="language-content">
                <CustomDropdown 
                    label={t('langRegion.langLabel')}
                    subLabel={t('langRegion.langSub')}
                    options={languageOptions}
                    value={language}
                    onChange={handleLanguageChange}
                />

                <CustomDropdown 
                    label={t('langRegion.regLabel')}
                    subLabel={t('langRegion.regSub')}
                    options={regionOptions}
                    value={region}
                    onChange={handleRegionChange}
                />
            </div>
        </div>
    );
};

export default Language;
