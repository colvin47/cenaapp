import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

const CITY_KEY = "cena.local-city.v1";
type CityContextValue = { city: string; setCity: (value: string) => void; ready: boolean };
const CityContext = createContext<CityContextValue | null>(null);

export function LocalCityProvider({ children }: { children: ReactNode }) {
  const [city, setCityState] = useState("Campinas, SP");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let mounted = true;
    void AsyncStorage.getItem(CITY_KEY).then(value => {
      if (mounted) {
        if (value?.trim()) setCityState(value.trim());
        setReady(true);
      }
    }).catch(() => { if (mounted) setReady(true); });
    return () => { mounted = false; };
  }, []);

  const setCity = useCallback((value: string) => {
    const normalized = value.trim();
    setCityState(normalized || "Campinas, SP");
    void AsyncStorage.setItem(CITY_KEY, normalized || "Campinas, SP").catch(() => undefined);
  }, []);
  const value = useMemo(() => ({ city, setCity, ready }), [city, ready, setCity]);
  return <CityContext.Provider value={value}>{children}</CityContext.Provider>;
}

export function useLocalCity() {
  const value = useContext(CityContext);
  if (!value) throw new Error("useLocalCity precisa estar dentro de LocalCityProvider.");
  return value;
}
