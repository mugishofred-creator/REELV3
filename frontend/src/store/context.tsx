import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
} from "react";
import { loadJSON, saveJSON, STORAGE_KEYS } from "./storage";

export type ContractType =
  | "CDI"
  | "CDD"
  | "Stage"
  | "Alternance"
  | "Freelance"
  | "Intérim";

export type RemoteMode = "Sur site" | "Hybride" | "Télétravail";

export type Platform =
  | "LinkedIn"
  | "Indeed"
  | "Welcome to the Jungle"
  | "APEC"
  | "HelloWork"
  | "France Travail"
  | "Glassdoor";

export type AppStatus =
  | "file"
  | "envoyee"
  | "vue"
  | "entretien"
  | "offre"
  | "refus";

export interface Profile {
  fullName: string;
  headline: string;
  email: string;
  phone: string;
  city: string;
  linkedin: string;
  portfolio: string;
  summary: string;
  skills: string[];
  experienceYears: number;
  educationLevel: string;
  preferredContracts: ContractType[];
  preferredRemote: RemoteMode[];
  salaryMin: number;
  availableFrom: string;
}

export interface AISettings {
  apiKey: string;
  model: string;
  smartMode: boolean;
}

export interface CVDoc {
  id: string;
  name: string;
  uri: string;
  size?: number;
  addedAt: string;
  isDefault: boolean;
  rawText?: string;
}

export interface Letter {
  id: string;
  name: string;
  body: string;
  isDefault: boolean;
  createdAt: string;
}

export interface Offer {
  id: string;
  title: string;
  company: string;
  location: string;
  remote: RemoteMode;
  contract: ContractType;
  salaryMin?: number;
  salaryMax?: number;
  platform: Platform;
  description: string;
  skills: string[];
  postedDaysAgo: number;
  url: string;
  highlight?: "junior" | "stage" | "remote" | "urgent";
}

export interface Filters {
  keywords: string;
  location: string;
  contracts: ContractType[];
  remote: RemoteMode[];
  platforms: Platform[];
  salaryMin: number;
  excludeFakeOffers: boolean;
  minMatchScore: number;
}

export interface Application {
  id: string;
  offer: Offer;
  cvId?: string;
  letterId?: string;
  letterText?: string;
  status: AppStatus;
  matchScore?: number;
  aiReasons?: string[];
  aiRedFlags?: string[];
  createdAt: string;
  sentAt?: string;
  updatedAt: string;
  notes: string;
  nextFollowUp?: string;
  followUpSent?: boolean;
  responseAt?: string;
}

export interface Campaign {
  running: boolean;
  dailyLimit: number;
  sentToday: number;
  lastRunDate: string;
  minScoreToAutoQueue: number;
}

export const DEFAULT_PROFILE: Profile = {
  fullName: "",
  headline: "",
  email: "",
  phone: "",
  city: "",
  linkedin: "",
  portfolio: "",
  summary: "",
  skills: [],
  experienceYears: 0,
  educationLevel: "",
  preferredContracts: [],
  preferredRemote: [],
  salaryMin: 0,
  availableFrom: "",
};

export const DEFAULT_AI: AISettings = {
  apiKey: "",
  model: "gpt-4o-mini",
  smartMode: true,
};

export const DEFAULT_FILTERS: Filters = {
  keywords: "",
  location: "",
  contracts: [],
  remote: [],
  platforms: [],
  salaryMin: 0,
  excludeFakeOffers: true,
  minMatchScore: 0,
};

export const DEFAULT_CAMPAIGN: Campaign = {
  running: false,
  dailyLimit: 25,
  sentToday: 0,
  lastRunDate: "",
  minScoreToAutoQueue: 60,
};

type Ctx = {
  profile: Profile;
  ai: AISettings;
  cvs: CVDoc[];
  letters: Letter[];
  filters: Filters;
  applications: Application[];
  campaign: Campaign;
  loaded: boolean;

  updateProfile: (patch: Partial<Profile>) => void;
  updateAI: (patch: Partial<AISettings>) => void;
  addCV: (cv: Omit<CVDoc, "id" | "addedAt" | "isDefault"> & { isDefault?: boolean }) => void;
  updateCV: (id: string, patch: Partial<CVDoc>) => void;
  deleteCV: (id: string) => void;
  setDefaultCV: (id: string) => void;
  addLetter: (l: Omit<Letter, "id" | "createdAt" | "isDefault"> & { isDefault?: boolean }) => string;
  updateLetter: (id: string, patch: Partial<Letter>) => void;
  deleteLetter: (id: string) => void;
  setDefaultLetter: (id: string) => void;
  updateFilters: (patch: Partial<Filters>) => void;
  resetFilters: () => void;

  addApplication: (a: Omit<Application, "id" | "createdAt" | "updatedAt" | "status" | "notes"> & {
    status?: AppStatus;
    notes?: string;
  }) => string;
  updateApplication: (id: string, patch: Partial<Application>) => void;
  deleteApplication: (id: string) => void;
  setStatus: (id: string, status: AppStatus) => void;
  markSent: (id: string) => void;
  isQueuedOrApplied: (offerId: string) => boolean;

  updateCampaign: (patch: Partial<Campaign>) => void;
  resetSentToday: () => void;

  resetAll: () => void;
};

const DataContext = createContext<Ctx | null>(null);

const rid = () =>
  Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

const todayKey = () => new Date().toISOString().slice(0, 10);

export function DataProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<Profile>(DEFAULT_PROFILE);
  const [ai, setAI] = useState<AISettings>(DEFAULT_AI);
  const [cvs, setCVs] = useState<CVDoc[]>([]);
  const [letters, setLetters] = useState<Letter[]>([]);
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [applications, setApplications] = useState<Application[]>([]);
  const [campaign, setCampaign] = useState<Campaign>(DEFAULT_CAMPAIGN);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      const [p, a, c, l, f, apps, cmp] = await Promise.all([
        loadJSON<Profile>(STORAGE_KEYS.profile, DEFAULT_PROFILE),
        loadJSON<AISettings>(STORAGE_KEYS.ai, DEFAULT_AI),
        loadJSON<CVDoc[]>(STORAGE_KEYS.cvs, []),
        loadJSON<Letter[]>(STORAGE_KEYS.letters, []),
        loadJSON<Filters>(STORAGE_KEYS.filters, DEFAULT_FILTERS),
        loadJSON<Application[]>(STORAGE_KEYS.applications, []),
        loadJSON<Campaign>(STORAGE_KEYS.campaign, DEFAULT_CAMPAIGN),
      ]);
      setProfile({ ...DEFAULT_PROFILE, ...p });
      setAI({ ...DEFAULT_AI, ...a });
      setCVs(c);
      setLetters(l);
      setFilters({ ...DEFAULT_FILTERS, ...f });
      setApplications(apps);
      const today = todayKey();
      const cmpFixed = cmp.lastRunDate !== today
        ? { ...cmp, sentToday: 0, lastRunDate: today }
        : cmp;
      setCampaign({ ...DEFAULT_CAMPAIGN, ...cmpFixed });
      setLoaded(true);
    })();
  }, []);

  useEffect(() => { if (loaded) saveJSON(STORAGE_KEYS.profile, profile); }, [profile, loaded]);
  useEffect(() => { if (loaded) saveJSON(STORAGE_KEYS.ai, ai); }, [ai, loaded]);
  useEffect(() => { if (loaded) saveJSON(STORAGE_KEYS.cvs, cvs); }, [cvs, loaded]);
  useEffect(() => { if (loaded) saveJSON(STORAGE_KEYS.letters, letters); }, [letters, loaded]);
  useEffect(() => { if (loaded) saveJSON(STORAGE_KEYS.filters, filters); }, [filters, loaded]);
  useEffect(() => { if (loaded) saveJSON(STORAGE_KEYS.applications, applications); }, [applications, loaded]);
  useEffect(() => { if (loaded) saveJSON(STORAGE_KEYS.campaign, campaign); }, [campaign, loaded]);

  const updateProfile = useCallback(
    (patch: Partial<Profile>) => setProfile((p) => ({ ...p, ...patch })),
    []
  );
  const updateAI = useCallback(
    (patch: Partial<AISettings>) => setAI((a) => ({ ...a, ...patch })),
    []
  );

  const addCV: Ctx["addCV"] = useCallback((cv) => {
    setCVs((p) => {
      const id = rid();
      const isDefault = cv.isDefault ?? p.length === 0;
      const next: CVDoc = {
        id,
        name: cv.name,
        uri: cv.uri,
        size: cv.size,
        rawText: cv.rawText,
        addedAt: new Date().toISOString(),
        isDefault,
      };
      const cleaned = isDefault ? p.map((x) => ({ ...x, isDefault: false })) : p;
      return [next, ...cleaned];
    });
  }, []);

  const updateCV: Ctx["updateCV"] = useCallback(
    (id, patch) => setCVs((p) => p.map((x) => (x.id === id ? { ...x, ...patch } : x))),
    []
  );

  const deleteCV: Ctx["deleteCV"] = useCallback((id) => {
    setCVs((p) => {
      const removed = p.find((x) => x.id === id);
      const next = p.filter((x) => x.id !== id);
      if (removed?.isDefault && next.length > 0) next[0].isDefault = true;
      return [...next];
    });
  }, []);

  const setDefaultCV: Ctx["setDefaultCV"] = useCallback(
    (id) => setCVs((p) => p.map((x) => ({ ...x, isDefault: x.id === id }))),
    []
  );

  const addLetter: Ctx["addLetter"] = useCallback((l) => {
    const id = rid();
    setLetters((p) => {
      const isDefault = l.isDefault ?? p.length === 0;
      const next: Letter = {
        id,
        name: l.name,
        body: l.body,
        isDefault,
        createdAt: new Date().toISOString(),
      };
      const cleaned = isDefault ? p.map((x) => ({ ...x, isDefault: false })) : p;
      return [next, ...cleaned];
    });
    return id;
  }, []);

  const updateLetter: Ctx["updateLetter"] = useCallback(
    (id, patch) => setLetters((p) => p.map((x) => (x.id === id ? { ...x, ...patch } : x))),
    []
  );

  const deleteLetter: Ctx["deleteLetter"] = useCallback((id) => {
    setLetters((p) => {
      const removed = p.find((x) => x.id === id);
      const next = p.filter((x) => x.id !== id);
      if (removed?.isDefault && next.length > 0) next[0].isDefault = true;
      return [...next];
    });
  }, []);

  const setDefaultLetter: Ctx["setDefaultLetter"] = useCallback(
    (id) => setLetters((p) => p.map((x) => ({ ...x, isDefault: x.id === id }))),
    []
  );

  const updateFilters = useCallback(
    (patch: Partial<Filters>) => setFilters((f) => ({ ...f, ...patch })),
    []
  );
  const resetFilters = useCallback(() => setFilters(DEFAULT_FILTERS), []);

  const addApplication: Ctx["addApplication"] = useCallback((a) => {
    const id = rid();
    const now = new Date().toISOString();
    setApplications((p) => [
      {
        id,
        offer: a.offer,
        cvId: a.cvId,
        letterId: a.letterId,
        letterText: a.letterText,
        status: a.status ?? "file",
        matchScore: a.matchScore,
        aiReasons: a.aiReasons,
        aiRedFlags: a.aiRedFlags,
        createdAt: now,
        updatedAt: now,
        notes: a.notes ?? "",
        nextFollowUp: a.nextFollowUp,
      },
      ...p,
    ]);
    return id;
  }, []);

  const updateApplication: Ctx["updateApplication"] = useCallback(
    (id, patch) =>
      setApplications((p) =>
        p.map((x) =>
          x.id === id
            ? { ...x, ...patch, updatedAt: new Date().toISOString() }
            : x
        )
      ),
    []
  );

  const deleteApplication: Ctx["deleteApplication"] = useCallback(
    (id) => setApplications((p) => p.filter((x) => x.id !== id)),
    []
  );

  const setStatus: Ctx["setStatus"] = useCallback(
    (id, status) =>
      setApplications((p) =>
        p.map((x) => {
          if (x.id !== id) return x;
          const updates: Partial<Application> = {
            status,
            updatedAt: new Date().toISOString(),
          };
          if (status !== "file" && status !== "envoyee" && !x.responseAt) {
            updates.responseAt = new Date().toISOString();
          }
          return { ...x, ...updates };
        })
      ),
    []
  );

  const markSent: Ctx["markSent"] = useCallback((id) => {
    const sentAt = new Date().toISOString();
    const followUp = new Date();
    followUp.setDate(followUp.getDate() + 7);
    setApplications((p) =>
      p.map((x) =>
        x.id === id
          ? {
              ...x,
              status: "envoyee",
              sentAt,
              updatedAt: sentAt,
              nextFollowUp: followUp.toISOString(),
            }
          : x
      )
    );
    setCampaign((c) => {
      const today = todayKey();
      const sent = c.lastRunDate === today ? c.sentToday + 1 : 1;
      return { ...c, sentToday: sent, lastRunDate: today };
    });
  }, []);

  const isQueuedOrApplied = useCallback(
    (offerId: string) => applications.some((a) => a.offer.id === offerId),
    [applications]
  );

  const updateCampaign = useCallback(
    (patch: Partial<Campaign>) => setCampaign((c) => ({ ...c, ...patch })),
    []
  );

  const resetSentToday = useCallback(
    () => setCampaign((c) => ({ ...c, sentToday: 0, lastRunDate: todayKey() })),
    []
  );

  const resetAll = useCallback(() => {
    setProfile(DEFAULT_PROFILE);
    setAI(DEFAULT_AI);
    setCVs([]);
    setLetters([]);
    setFilters(DEFAULT_FILTERS);
    setApplications([]);
    setCampaign(DEFAULT_CAMPAIGN);
  }, []);

  const value = useMemo<Ctx>(
    () => ({
      profile, ai, cvs, letters, filters, applications, campaign, loaded,
      updateProfile, updateAI,
      addCV, updateCV, deleteCV, setDefaultCV,
      addLetter, updateLetter, deleteLetter, setDefaultLetter,
      updateFilters, resetFilters,
      addApplication, updateApplication, deleteApplication, setStatus, markSent, isQueuedOrApplied,
      updateCampaign, resetSentToday,
      resetAll,
    }),
    [
      profile, ai, cvs, letters, filters, applications, campaign, loaded,
      updateProfile, updateAI,
      addCV, updateCV, deleteCV, setDefaultCV,
      addLetter, updateLetter, deleteLetter, setDefaultLetter,
      updateFilters, resetFilters,
      addApplication, updateApplication, deleteApplication, setStatus, markSent, isQueuedOrApplied,
      updateCampaign, resetSentToday,
      resetAll,
    ]
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useData must be used within DataProvider");
  return ctx;
}
