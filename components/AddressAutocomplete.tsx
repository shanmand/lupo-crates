import React, { useState, useEffect, useRef } from 'react';
import { MapPin, Loader2, Search } from 'lucide-react';

interface AddressAutocompleteProps {
  value: string;
  onChange: (address: string) => void;
  placeholder?: string;
  className?: string;
}

interface NominatimResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
}

export const AddressAutocomplete: React.FC<AddressAutocompleteProps> = ({
  value,
  onChange,
  placeholder = "Search for address...",
  className = ""
}) => {
  const [query, setQuery] = useState(value);
  const [results, setResults] = useState<NominatimResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setQuery(value);
  }, [value]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const searchAddress = async (searchQuery: string) => {
    if (searchQuery.length < 3) {
      setResults([]);
      return;
    }

    setIsLoading(true);
    try {
      // Nominatim API - filtered for South Africa (countrycodes=za)
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&countrycodes=za&limit=5`,
        {
          headers: {
            'Accept-Language': 'en-US,en;q=0.9',
          }
        }
      );
      const data = await response.json();
      setResults(data);
      setShowDropdown(true);
    } catch (error) {
      console.error('Error fetching address:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newQuery = e.target.value;
    setQuery(newQuery);
    onChange(newQuery);

    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    timeoutRef.current = setTimeout(() => {
      searchAddress(newQuery);
    }, 500);
  };

  const handleSelect = (result: NominatimResult) => {
    setQuery(result.display_name);
    onChange(result.display_name);
    setShowDropdown(false);
    setResults([]);
  };

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <div className="relative">
        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
          {isLoading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
        </div>
        <input
          type="text"
          value={query}
          onChange={handleInputChange}
          onFocus={() => results.length > 0 && setShowDropdown(true)}
          placeholder={placeholder}
          className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-11 pr-4 py-4 text-sm font-bold outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
        />
      </div>

      {showDropdown && results.length > 0 && (
        <div className="absolute z-50 w-full mt-2 bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
          {results.map((result) => (
            <button
              key={result.place_id}
              onClick={() => handleSelect(result)}
              className="w-full text-left px-4 py-3 hover:bg-slate-50 flex items-start gap-3 transition-colors border-b border-slate-50 last:border-0"
            >
              <MapPin size={16} className="text-emerald-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-bold text-slate-800 line-clamp-2">{result.display_name}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
