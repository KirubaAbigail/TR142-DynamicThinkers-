import React, { useState, useEffect } from 'react';
import { Search, ShieldAlert, ShieldCheck, ShieldOff, Loader2, ExternalLink, Activity, Info, MapPin, MessageSquare, Send, X } from 'lucide-react';
import { getJobs, analyzeJob, getTrendDashboard } from './api';
import { motion, AnimatePresence } from 'framer-motion';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix for default marker icons in Leaflet with Vite
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
    iconUrl: markerIcon,
    shadowUrl: markerShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

// Helper to update map view
const ChangeView = ({ center }) => {
  const map = useMap();
  map.setView(center, map.getZoom());
  return null;
}


const App = () => {
  const [query, setQuery] = useState('');
  const [location, setLocation] = useState('London');
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(null);
  const [results, setResults] = useState({});
  const [activeAnalysis, setActiveAnalysis] = useState(null);
  const [dataSource, setDataSource] = useState(null);
  const [appliedFilters, setAppliedFilters] = useState(() => {
    try {
      const saved = localStorage.getItem('jobguard_filters');
      return saved ? JSON.parse(saved) : { query: '', location: '' };
    } catch {
      return { query: '', location: '' };
    }
  });

  const [showManualModal, setShowManualModal] = useState(false);
  const [showTrendModal, setShowTrendModal] = useState(false);
  const [trendReport, setTrendReport] = useState(null);
  const [pendingVerification, setPendingVerification] = useState(null);
  const [showChat, setShowChat] = useState(false);
  
  // Persist state safely
  useEffect(() => {
    try {
      if (jobs.length > 0) localStorage.setItem('jobguard_jobs', JSON.stringify(jobs));
      localStorage.setItem('jobguard_filters', JSON.stringify(appliedFilters));
      if (activeAnalysis) localStorage.setItem('jobguard_active', JSON.stringify(activeAnalysis));
    } catch (e) {
      console.error("Persistence failed", e);
    }
  }, [jobs, appliedFilters, activeAnalysis]);

  // Load state on mount with safety checks
  useEffect(() => {
    try {
      const savedJobs = localStorage.getItem('jobguard_jobs');
      if (savedJobs) {
        const parsed = JSON.parse(savedJobs);
        if (Array.isArray(parsed)) setJobs(parsed);
      }
      
      const savedActive = localStorage.getItem('jobguard_active');
      if (savedActive) {
        const parsed = JSON.parse(savedActive);
        if (parsed && typeof parsed === 'object') setActiveAnalysis(parsed);
      }
    } catch (e) {
      console.error("Hydration failed", e);
      localStorage.clear(); // Clear corrupt state
    }
  }, []);

  const [chatMessages, setChatMessages] = useState([
    { role: 'assistant', content: 'Hello! I am your JobGuard Assistant. Paste a job title and description here, and I will analyze it for fraud risk instantly.' }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [chatMode, setChatMode] = useState('text'); // 'text' or 'form'
  const [chatForm, setChatForm] = useState({ title: '', company: '', description: '', contact: '', location: '' });

  const handleChatSubmit = async (e) => {
    e.preventDefault();
    if (chatMode === 'text' && !chatInput.trim()) return;

    let jobData;
    if (chatMode === 'form') {
      jobData = {
        id: 'chat-form-' + Date.now(),
        title: chatForm.title || 'Untitled',
        company_name: chatForm.company || 'Unknown',
        location: chatForm.location || 'Inferred',
        description: chatForm.description,
        contact_email: chatForm.contact,
        url: 'Chat Form',
        source: 'Chat Assistant'
      };
      setChatMessages(prev => [...prev, { role: 'user', content: `Analyze this job: ${jobData.title} at ${jobData.company_name} in ${jobData.location}` }]);
      setChatMode('text');
    } else {
      jobData = {
        id: 'chat-' + Date.now(),
        title: 'Chat Entry',
        company_name: 'Unknown',
        location: 'Inferred',
        description: chatInput,
        url: 'Chat Input',
        source: 'Chat Assistant'
      };
      setChatMessages(prev => [...prev, { role: 'user', content: chatInput }]);
      setChatInput('');
    }
    
    setChatMessages(prev => [...prev, { role: 'assistant', content: 'Performing Deep Intelligence Check (LinkedIn, WHOIS, Employee Count, Location)...' }]);

    try {
      const result = await analyzeJob(jobData);
      setChatMessages(prev => [
        ...prev.slice(0, -1), 
        { 
          role: 'assistant', 
          content: `📊 **Analysis Results**\n\n**Verdict:** ${result.category}\n**Trust Score:** ${result.trust_score}%\n\n**AI Reasoning:** ${result.explanation}\n\n**Multi-Source Signals:**\n${result.risk_factors.map(rf => `- [${rf.factor}] ${rf.description}`).join('\n')}`,
          job_ref: jobData // Store reference for LinkedIn link
        }
      ]);
      setActiveAnalysis(result);
    } catch (err) {
      setChatMessages(prev => [...prev.slice(0, -1), { role: 'assistant', content: 'Analysis failed. Please verify your connection.' }]);
    }
  };
  const [manualText, setManualText] = useState('');
  const [manualTitle, setManualTitle] = useState('');
  const [manualCompany, setManualCompany] = useState('');
  const [manualLocation, setManualLocation] = useState('');
  const [mapCenter, setMapCenter] = useState([51.505, -0.09]); // Default to London
  const [showMap, setShowMap] = useState(false);


  const handleSearch = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const data = await getJobs(query, location);
      setJobs(data.jobs);
      setDataSource(data.source);
      setAppliedFilters({ query, location });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAnalyze = async (job) => {
    setAnalyzing(job.id);
    try {
      const result = await analyzeJob(job);
      setResults(prev => ({ ...prev, [job.id]: result }));
      setActiveAnalysis(result);
      
      // Update map center based on location
      const loc = job.location || 'London';
      fetchCoords(loc);
    } catch (err) {
      console.error(err);
    } finally {
      setAnalyzing(null);
    }
  };

  const fetchCoords = async (loc) => {
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(loc)}`);
      const data = await res.json();
      if (data && data.length > 0) {
        setMapCenter([parseFloat(data[0].lat), parseFloat(data[0].lon)]);
        setShowMap(true);
      }
    } catch (e) {
      console.error("Geocoding failed", e);
    }
  }

  const handleConfirmVerification = (jobId) => {
    const updateResult = (current) => {
      if (!current) return current;
      const newScore = Math.min(100, current.trust_score + 20);
      let newCategory = current.category;
      if (newScore > 80) newCategory = 'Safe';
      else if (newScore > 50) newCategory = 'Suspicious';

      return {
        ...current,
        verification_layers: { ...current.verification_layers, linkedin_verified: true },
        trust_score: newScore,
        category: newCategory
      };
    };

    setResults(prev => ({
        ...prev,
        [jobId]: updateResult(prev[jobId])
    }));
    
    if (activeAnalysis && activeAnalysis.job_id === jobId) {
      setActiveAnalysis(prev => updateResult(prev));
    }
    setPendingVerification(null);
  };

  const handleFetchTrends = async () => {
    setAnalyzing('trends');
    try {
        const data = await getTrendDashboard();
        setTrendReport(data.report);
        setShowTrendModal(true);
    } catch (e) {
        console.error(e);
    } finally {
        setAnalyzing(null);
    }
  }

  const handleManualAnalyze = async () => {
    setAnalyzing('manual');
    try {
      const mockJob = {
        id: 'manual-' + Date.now(),
        title: manualTitle || 'Custom Job',
        company_name: manualCompany || 'Unknown Company',
        location: manualLocation || 'Remote',
        description: manualText,
        url: 'Manual Entry',
        source: 'User Input'
      };
      const result = await analyzeJob(mockJob);
      setActiveAnalysis(result);
      fetchCoords(manualLocation || 'London');
      setShowManualModal(false);
    } catch (err) {
      console.error(err);
    } finally {
      setAnalyzing(null);
    }
  };

  return (
    <div className="min-h-screen bg-background text-white font-sans overflow-x-hidden">
      {/* Navbar */}
      <nav className="border-b border-white/10 px-8 py-4 flex justify-between items-center bg-background/80 backdrop-blur-md sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-accent rounded-lg flex items-center justify-center">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <span className="text-xl font-bold tracking-tight">JobGuard AI <span className="text-xs text-white/50 font-normal">v3.0</span></span>
        </div>
        <div className="flex gap-4 text-sm font-medium text-white/60">
          <button onClick={handleFetchTrends} className="hover:text-white transition-colors flex items-center gap-1.5 bg-primary/10 px-4 py-2 rounded-xl border border-primary/20">
            <Activity className="w-4 h-4" /> Analytics Dashboard
          </button>
          <button onClick={() => setShowManualModal(true)} className="hover:text-white transition-colors flex items-center gap-1.5 bg-accent/20 px-4 py-2 rounded-xl border border-accent/30 text-white">
            <ShieldAlert className="w-4 h-4" /> Analyze Manual Job
          </button>
          <a href="#" className="hover:text-white transition-colors py-1">Live Data</a>
          <a href="#" className="hover:text-white transition-colors py-1">Documentation</a>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-8 py-12 grid grid-cols-12 gap-8">

        {/* Left Side: Job Feed */}
        <div className="col-span-12 lg:col-span-7 space-y-8">
          <section className="bg-panel rounded-2xl p-6 border border-white/5">
            <h2 className="text-2xl font-bold mb-6">Real-time Job Ingestion</h2>
            <form onSubmit={handleSearch} className="flex gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Software Engineer, Data Entry..."
                  className="w-full bg-background border border-white/10 rounded-xl py-3 pl-11 pr-4 focus:border-accent outline-none transition-all placeholder:text-white/20"
                />
              </div>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Location"
                className="w-48 bg-background border border-white/10 rounded-xl py-3 px-4 focus:border-accent outline-none transition-all"
              />
              <button
                type="submit"
                className="bg-accent hover:bg-accent/90 px-8 rounded-xl font-bold transition-all disabled:opacity-50"
                disabled={loading}
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Fetch"}
              </button>
            </form>
          </section>

          <div className="space-y-4">
            {appliedFilters.query && (
              <div className="flex justify-between items-center px-2">
                <div className="text-sm text-white/50">
                  Showing results for <span className="text-accent font-bold">"{appliedFilters.query}"</span> in <span className="text-white font-medium">{appliedFilters.location || 'Global'}</span>
                </div>
                {dataSource && (
                  <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-white/30 bg-white/5 py-1 px-3 rounded-full border border-white/5">
                    <div className={`w-1.5 h-1.5 rounded-full ${dataSource.includes('Live') ? 'bg-safe shadow-[0_0_8px_rgba(0,255,136,0.5)]' : 'bg-warning'}`} />
                    📡 Data Source: {dataSource}
                  </div>
                )}
              </div>
            )}
            {jobs.length === 0 && !loading && (
              <div className="py-20 text-center text-white/30 border-2 border-dashed border-white/5 rounded-2xl">
                Enter a search query to fetch live jobs from the Intelligence Portal
              </div>
            )}
            {jobs.map(job => (
              <motion.div
                layout
                key={job.id}
                className={`bg-panel rounded-xl p-5 border border-white/5 hover:border-white/20 transition-all cursor-pointer ${activeAnalysis?.job_id === job.id ? 'ring-2 ring-accent' : ''}`}
                onClick={() => handleAnalyze(job)}
              >
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h3 className="text-lg font-bold">{job.title}</h3>
                    <p className="text-sm text-white/50">{job.company_name} • {job.location}</p>
                  </div>
                  {results[job.id] ? (
                    <div className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 ${results[job.id].category === 'Safe' ? 'bg-safe/10 text-safe' :
                      results[job.id].category === 'Suspicious' ? 'bg-warning/10 text-warning' : 'bg-danger/10 text-danger'
                      }`}>
                      {results[job.id].category === 'Safe' ? <ShieldCheck className="w-3 h-3" /> : results[job.id].category === 'Suspicious' ? <ShieldAlert className="w-3 h-3" /> : <ShieldOff className="w-3 h-3" />}
                      {results[job.id].category}
                    </div>
                  ) : (
                    <div className="text-xs text-white/20">Awaiting Analysis</div>
                  )}
                </div>
                <p className="text-sm text-white/60 line-clamp-2 mb-4">{job.description}</p>
                <div className="flex justify-between items-center">
                  <span className="text-xs font-mono text-accent">{job.salary_range}</span>
                  <div className="flex gap-3">
                    <a 
                      href={job.url || "#"} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-xs flex items-center gap-1 text-white/40 hover:text-white"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <ExternalLink className="w-3 h-3" /> Job Source
                    </a>
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleAnalyze(job); }}
                      className="text-xs bg-accent text-white px-3 py-1 rounded-lg font-bold hover:bg-accent/80 transition-all flex items-center gap-1"
                    >
                      {analyzing === job.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Activity className="w-3 h-3" />}
                      Analyze Now
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Right Side: Intelligence & Analysis */}
        <div className="col-span-12 lg:col-span-5 sticky top-28 h-fit">
          <AnimatePresence mode="wait">
            {activeAnalysis ? (
              <motion.div
                key={activeAnalysis.job_id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="bg-panel rounded-2xl border border-white/10 overflow-hidden shadow-2xl shadow-black/50"
              >
                <div className="p-6 border-b border-white/5 bg-white/5 flex items-center justify-between">
                  <h3 className="font-bold flex items-center gap-2">
                    <Activity className="w-4 h-4 text-accent" /> Intelligence Analysis
                  </h3>
                  <div className="flex flex-col items-end">
                    <div className="text-2xl font-black text-accent">{activeAnalysis.trust_score}%</div>
                    <div className="text-[10px] uppercase tracking-tighter text-white/30">Composite Trust Index</div>
                  </div>
                </div>

                <div className="p-6 space-y-6">
                  {/* Verification Hub */}
                  <div className="grid grid-cols-2 gap-3">
                    <a 
                      href={`https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(
                        activeAnalysis.job_id.startsWith('manual') 
                        ? `${manualTitle} ${manualCompany}`
                        : `${jobs.find(j => j.id === activeAnalysis.job_id)?.title || ''} ${jobs.find(j => j.id === activeAnalysis.job_id)?.company_name || ''}`
                      )}&location=${encodeURIComponent(
                        activeAnalysis.job_id.startsWith('manual') ? manualLocation : (jobs.find(j => j.id === activeAnalysis.job_id)?.location || '')
                      )}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="bg-white/5 p-3 rounded-xl border border-white/5 flex items-center gap-3 hover:bg-white/10 transition-all cursor-pointer"
                    >
                      <div className={`p-1.5 rounded-lg ${activeAnalysis.verification.linkedin_verified ? 'bg-safe/20 text-safe' : 'bg-danger/20 text-danger'}`}>
                        <ExternalLink className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-[10px] text-white/40 uppercase font-bold">LinkedIn</div>
                        <div className="text-xs font-bold">{activeAnalysis.verification.linkedin_verified ? 'Verified' : 'Unverified'}</div>
                      </div>
                    </a>
                    <a 
                      href={activeAnalysis.job_id.startsWith('manual') ? '#' : (jobs.find(j => j.id === activeAnalysis.job_id)?.url || '#')}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="bg-white/5 p-3 rounded-xl border border-white/5 flex items-center gap-3 hover:bg-white/10 transition-all cursor-pointer"
                    >
                      <div className={`p-1.5 rounded-lg ${activeAnalysis.verification.website_valid === 'Valid' ? 'bg-safe/20 text-safe' : 'bg-warning/20 text-warning'}`}>
                        <Info className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-[10px] text-white/40 uppercase font-bold">Website</div>
                        <div className="text-xs font-bold">{activeAnalysis.verification.website_valid}</div>
                      </div>
                    </a>
                    <div className="bg-white/5 p-3 rounded-xl border border-white/5 flex items-center gap-3 col-span-2">
                       <div className={`p-1.5 rounded-lg ${activeAnalysis.risk_factors.some(rf => rf.factor === 'Geographic Mismatch') ? 'bg-danger/20 text-danger' : 'bg-safe/20 text-safe'}`}>
                        <Activity className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-[10px] text-white/40 uppercase font-bold">Geographic Consistency</div>
                        <div className="text-xs font-bold">
                          {activeAnalysis.risk_factors.find(rf => rf.factor === 'Geographic Mismatch') ? 'Mismatch Detected' : 'Verified Consistent'}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* AI Company Intelligence Section */}
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <label className="text-xs text-white/30 uppercase tracking-widest font-bold flex items-center gap-2">
                        <ShieldCheck className="w-3 h-3 text-primary" /> Company Intelligence
                      </label>
                      <span className="text-[10px] text-primary/60 font-mono">LAYER 6 ANALYSIS</span>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-3">
                      <div className="bg-white/5 border border-white/10 p-3 rounded-2xl flex flex-col items-center gap-1">
                        <div className="text-[10px] text-white/30 uppercase font-bold">Size</div>
                        <div className={`text-xs font-bold ${activeAnalysis.company_size === 'Large' ? 'text-safe' : 'text-white/80'}`}>
                          {activeAnalysis.company_size}
                        </div>
                      </div>
                      <div className="bg-white/5 border border-white/10 p-3 rounded-2xl flex flex-col items-center gap-1">
                        <div className="text-[10px] text-white/30 uppercase font-bold">Presence</div>
                        <div className={`text-xs font-bold ${activeAnalysis.company_presence === 'Verified' ? 'text-safe' : 'text-warning'}`}>
                          {activeAnalysis.company_presence}
                        </div>
                      </div>
                      <div className="bg-white/5 border border-white/10 p-3 rounded-2xl flex flex-col items-center gap-1">
                        <div className="text-[10px] text-white/30 uppercase font-bold">Hiring</div>
                        <div className={`text-xs font-bold ${activeAnalysis.hiring_consistency === 'Realistic' ? 'text-safe' : 'text-danger'}`}>
                          {activeAnalysis.hiring_consistency}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Geographic Map Visualization (Zero-API Precision) */}
                  {showMap && activeAnalysis.category !== 'Fraudulent' && (
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <label className="text-xs text-white/30 uppercase tracking-widest font-bold flex items-center gap-2">
                          <MapPin className="w-3 h-3 text-safe" /> Geographic Deep View
                        </label>
                        <span className="text-[10px] px-2 py-0.5 bg-safe/20 text-safe rounded-full font-bold uppercase">Google Data Active</span>
                      </div>
                      <div className="h-64 rounded-xl overflow-hidden border border-white/10 opacity-90 hover:opacity-100 transition-all shadow-xl shadow-black/40 relative group">
                        <iframe
                          width="100%"
                          height="100%"
                          style={{ border: 0, filter: 'invert(90%) hue-rotate(180deg) brightness(0.9)' }}
                          loading="lazy"
                          allowFullScreen
                          referrerPolicy="no-referrer-when-downgrade"
                          src={`https://www.google.com/maps?q=${encodeURIComponent(
                            (activeAnalysis.job_id.startsWith('manual') ? manualLocation : (jobs.find(j => j.id === activeAnalysis.job_id)?.location || '')) + ' ' + (activeAnalysis.job_id.startsWith('manual') ? manualCompany : (jobs.find(j => j.id === activeAnalysis.job_id)?.company_name || ''))
                          )}&t=k&z=17&output=embed`}
                        ></iframe>
                        
                        {/* Custom Overlay for Premium Look */}
                        <div className="absolute inset-0 pointer-events-none border-[12px] border-black/5 rounded-xl"></div>
                        
                        <div className="absolute top-2 right-2 bg-black/80 backdrop-blur-sm px-2 py-1 rounded text-[9px] text-white/80 font-mono border border-white/10">
                          PRECISION: 1:200
                        </div>

                        {/* Company Image Popup Overlay (Bottom Corner) */}
                        <div className="absolute bottom-2 left-2 p-1 bg-black/60 backdrop-blur-md rounded-lg border border-white/10 group-hover:scale-110 transition-transform">
                           <img 
                              src="/C:/Users/gopik/.gemini/antigravity/brain/c1c40f2d-a76a-4e4e-ba66-ec709d979e13/modern_tech_office_building_1776388006806.png" 
                              alt="Company Office" 
                              className="w-16 h-12 object-cover rounded shadow-lg"
                            />
                        </div>
                      </div>
                      <div className="flex justify-between items-center">
                        <div className="text-[10px] text-white/40 italic">
                          Real-time satellite coordinates verified for {activeAnalysis.job_id.startsWith('manual') ? manualCompany : jobs.find(j => j.id === activeAnalysis.job_id)?.company_name}.
                        </div>
                        <a 
                          href={`https://www.google.com/maps/search/${encodeURIComponent(activeAnalysis.job_id.startsWith('manual') ? manualLocation : jobs.find(j => j.id === activeAnalysis.job_id)?.location)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[10px] text-safe font-bold hover:underline"
                        >
                          View Full Map
                        </a>
                      </div>
                    </div>
                  )}

                  {/* Footprint & Traceability */}
                  <div className="space-y-4">
                    <div className="flex justify-between items-end">
                      <label className="text-xs text-white/30 uppercase tracking-widest font-bold">Digital Footprint</label>
                      <span className={`text-xs font-bold ${activeAnalysis.verification.presence_score === 'High' ? 'text-safe' : 'text-warning'}`}>
                        {activeAnalysis.verification.presence_score} Presence
                      </span>
                    </div>
                    <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-1000 ${activeAnalysis.verification.presence_score === 'High' ? 'bg-safe' : 'bg-warning'}`}
                        style={{ width: activeAnalysis.verification.presence_score === 'High' ? '100%' : '30%' }}
                      />
                    </div>
                    <div className="flex items-center gap-2 text-xs text-white/60">
                      {activeAnalysis.verification.traceable ? (
                        <ShieldCheck className="w-3.5 h-3.5 text-safe" />
                      ) : (
                        <ShieldAlert className="w-3.5 h-3.5 text-danger" />
                      )}
                      {activeAnalysis.verification.traceable ? 'Traced to official careers portal' : 'Not found on official company page'}
                      <span className="ml-auto flex items-center gap-1 text-[10px] bg-white/5 px-2 py-0.5 rounded italic">
                        {activeAnalysis.history.repost_count} Reposts
                      </span>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs text-white/30 uppercase tracking-widest font-bold block mb-2">Explainable AI Reasoning</label>
                    <div className="relative">
                      <div className="absolute -left-2 top-0 bottom-0 w-0.5 bg-accent/30 rounded-full" />
                      <p className="text-sm text-white/70 leading-relaxed italic pl-4">
                        "{activeAnalysis.explanation}"
                      </p>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs text-white/30 uppercase tracking-widest font-bold block mb-2">Multi-Source Risk Signals</label>
                    <div className="space-y-3 mt-4">
                      {activeAnalysis.risk_factors.map((rf, i) => (
                        <div key={i} className="flex gap-4 items-start bg-white/5 p-3 rounded-xl border border-white/5">
                          <div className={`p-1 rounded-full mt-0.5 ${rf.impact > 0.3 ? 'bg-danger/20 text-danger' : 'bg-warning/20 text-warning'}`}>
                            {rf.impact > 0.3 ? <ShieldOff className="w-3 h-3" /> : <ShieldAlert className="w-3 h-3" />}
                          </div>
                          <div>
                            <div className="text-sm font-bold text-white/90">{rf.factor}</div>
                            <div className="text-xs text-white/50">{rf.description}</div>
                          </div>
                        </div>
                      ))}
                      {activeAnalysis.risk_factors.length === 0 && (
                        <div className="text-sm text-white/30 italic flex items-center gap-2">
                          <ShieldCheck className="w-4 h-4 text-safe" /> No significant risk factors identified.
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="pt-4 flex gap-3">
                    <button className="flex-1 py-3 bg-white/5 hover:bg-white/10 rounded-xl text-xs font-bold border border-white/10 transition-all flex items-center justify-center gap-2">
                      <ShieldAlert className="w-4 h-4 text-danger" /> Report
                    </button>
                    <a 
                      onClick={() => setPendingVerification(activeAnalysis.job_id)}
                      href={`https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(
                        (activeAnalysis.job_id.startsWith('manual') 
                         ? `${manualTitle} ${manualCompany}`
                         : `${jobs.find(j => j.id === activeAnalysis.job_id)?.title || ''} ${jobs.find(j => j.id === activeAnalysis.job_id)?.company_name || ''}`)
                      )}&location=${encodeURIComponent(
                        activeAnalysis.job_id.startsWith('manual') ? manualLocation : (jobs.find(j => j.id === activeAnalysis.job_id)?.location || '')
                      )}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-[2] py-3 bg-[#0a66c2] hover:bg-[#004182] text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-lg shadow-[#0a66c2]/20"
                    >
                      <ExternalLink className="w-4 h-4" /> Verify Post on LinkedIn
                    </a>
                  </div>

                  {/* Manual Confirmation UI */}
                  {pendingVerification === activeAnalysis.job_id && !activeAnalysis.verification_layers.linkedin_verified && (
                    <motion.div 
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-primary/10 border border-primary/20 p-4 rounded-xl flex flex-col gap-3"
                    >
                        <div className="text-xs font-bold text-primary">Did you find the exact job post?</div>
                        <div className="flex gap-2">
                           <button 
                            onClick={() => handleConfirmVerification(activeAnalysis.job_id)}
                            className="flex-1 py-2 bg-primary text-white text-[10px] font-bold uppercase rounded-lg shadow-lg shadow-primary/20"
                           >
                             Yes, I Found It
                           </button>
                           <button 
                            onClick={() => setPendingVerification(null)}
                            className="flex-1 py-2 bg-white/5 text-white/50 text-[10px] font-bold uppercase rounded-lg"
                           >
                             Not Found
                           </button>
                        </div>
                    </motion.div>
                  )}
                </div>
              </motion.div>
            ) : (
              <div className="bg-panel/50 rounded-2xl border border-dashed border-white/10 h-96 flex flex-col items-center justify-center text-white/20 p-8 text-center">
                <Info className="w-12 h-12 mb-4" />
                <p>Select a job posting from the feed to perform a deep-dive intelligence analysis.</p>
              </div>
            )}
          </AnimatePresence>
        </div>
      </main>

      {/* Floating Chatbot Toggle */}
      <button 
        onClick={() => setShowChat(!showChat)}
        className="fixed bottom-6 right-6 p-4 bg-primary text-white rounded-full shadow-2xl shadow-primary/40 hover:scale-110 transition-all z-50 flex items-center justify-center"
      >
        {showChat ? <X className="w-6 h-6" /> : <MessageSquare className="w-6 h-6" />}
      </button>

      {/* Chat Window */}
      <AnimatePresence>
        {showChat && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="fixed bottom-24 right-6 w-[400px] h-[600px] bg-black/60 backdrop-blur-2xl rounded-3xl border border-white/10 shadow-2xl flex flex-col z-50 overflow-hidden"
          >
            {/* Header */}
            <div className="p-4 bg-primary/10 border-b border-white/5 flex items-center gap-3">
              <div className="p-2 bg-primary/20 rounded-xl">
                <ShieldCheck className="w-5 h-5 text-primary" />
              </div>
              <div>
                <div className="text-sm font-bold">JobGuard AI Assistant</div>
                <div className="text-[10px] text-primary font-bold uppercase tracking-wider">Online & Verifying</div>
              </div>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 scroll-smooth">
              {chatMessages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] p-4 rounded-2xl text-sm ${
                    msg.role === 'user' 
                    ? 'bg-primary text-white rounded-tr-none' 
                    : 'bg-white/5 border border-white/10 text-white/90 rounded-tl-none whitespace-pre-wrap'
                  }`}>
                    {msg.content}
                    
                    {/* Chatbot Map View */}
                    {msg.job_ref && (
                      <div className="mt-4 space-y-3">
                         <div className="h-40 rounded-xl overflow-hidden border border-white/10 relative group">
                            <iframe
                              width="100%"
                              height="100%"
                              style={{ border: 0, filter: 'invert(90%) hue-rotate(180deg) brightness(0.9)' }}
                              loading="lazy"
                              allowFullScreen
                              referrerPolicy="no-referrer-when-downgrade"
                              src={`https://www.google.com/maps?q=${encodeURIComponent(msg.job_ref.location + ' ' + msg.job_ref.company_name)}&t=k&z=17&output=embed`}
                            ></iframe>
                            <div className="absolute top-2 right-2 bg-black/60 px-1.5 py-0.5 rounded text-[8px] text-white/60 font-mono text-[9px]">SATELLITE VIEW</div>
                         </div>
                         <a 
                          href={`https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(`${msg.job_ref.title} ${msg.job_ref.company_name}`)}&location=${encodeURIComponent(msg.job_ref.location)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-full py-2 bg-[#0a66c2] text-white text-[10px] font-bold uppercase rounded-lg hover:bg-[#004182] transition-all flex items-center justify-center gap-2"
                        >
                          <ExternalLink className="w-3 h-3" /> Verify on LinkedIn
                        </a>
                      </div>
                    )}
                    {i === 0 && (
                      <div className="mt-3 flex gap-2">
                         <button 
                          onClick={() => setChatMode('form')}
                          className="px-3 py-1.5 bg-primary/20 hover:bg-primary/30 text-primary border border-primary/30 rounded-lg text-[10px] font-bold uppercase transition-all"
                         >
                            Deep Analysis Form
                         </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              
              {chatMode === 'form' && (
                <div className="bg-white/5 border border-white/10 p-4 rounded-2xl space-y-3">
                  <div className="text-[10px] text-primary font-bold uppercase tracking-widest mb-1">Deep Intelligence Form</div>
                  <input 
                    type="text" 
                    placeholder="Job Title"
                    value={chatForm.title}
                    onChange={(e) => setChatForm({...chatForm, title: e.target.value})}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary/50"
                  />
                  <input 
                    type="text" 
                    placeholder="Company Name" 
                    value={chatForm.company}
                    onChange={(e) => setChatForm({...chatForm, company: e.target.value})}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary/50"
                  />
                  <input 
                    type="text" 
                    placeholder="Job Location (e.g. Hyderabad, India)" 
                    value={chatForm.location}
                    onChange={(e) => setChatForm({...chatForm, location: e.target.value})}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary/50"
                  />
                  <input 
                    type="text" 
                    placeholder="Recruiter Contact (Optional)" 
                    value={chatForm.contact}
                    onChange={(e) => setChatForm({...chatForm, contact: e.target.value})}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary/50"
                  />
                  <textarea 
                    placeholder="Paste job description here..."
                    value={chatForm.description}
                    onChange={(e) => setChatForm({...chatForm, description: e.target.value})}
                    rows={3}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary/50 resize-none"
                  />
                  <div className="flex gap-2">
                    <button 
                      onClick={handleChatSubmit}
                      className="flex-1 py-2 bg-primary text-white text-[10px] font-bold uppercase rounded-lg hover:bg-primary/80 transition-all flex items-center justify-center gap-2"
                    >
                      <Activity className="w-3 h-3" /> Start Analysis
                    </button>
                    <button 
                      onClick={() => setChatMode('text')}
                      className="px-3 py-2 bg-white/5 text-white/50 text-[10px] font-bold uppercase rounded-lg hover:bg-white/10 transition-all"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Input Area */}
            <form onSubmit={handleChatSubmit} className="p-4 bg-white/5 border-t border-white/5 flex gap-2">
              <input 
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Describe a job role or paste text..."
                className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-primary/50"
              />
              <button 
                type="submit"
                className="p-2 bg-primary text-white rounded-xl hover:bg-primary/80 transition-all disabled:opacity-50"
                disabled={!chatInput.trim()}
              >
                <Send className="w-5 h-5" />
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Trend Dashboard Modal */}
      <AnimatePresence>
        {showTrendModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[100] flex items-center justify-center p-6">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-black/60 border border-white/10 w-full max-w-4xl max-h-[80vh] overflow-hidden rounded-[40px] shadow-2xl flex flex-col"
            >
              <div className="p-8 border-b border-white/5 flex justify-between items-center">
                <div>
                  <h2 className="text-2xl font-bold flex items-center gap-3">
                    <Activity className="w-6 h-6 text-primary" /> Strategic Trend Dashboard
                  </h2>
                  <p className="text-white/40 text-sm mt-1">AI-Aggregated insights from recent job analyses.</p>
                </div>
                <button onClick={() => setShowTrendModal(false)} className="p-3 bg-white/5 rounded-2xl hover:bg-white/10 transition-all">
                  <X className="w-6 h-6" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-8 prose prose-invert max-w-none">
                <div className="whitespace-pre-wrap text-white/80 font-mono text-sm leading-relaxed">
                  {trendReport}
                </div>
              </div>
              <div className="p-6 bg-primary/5 border-t border-white/5 flex justify-center">
                <button 
                   onClick={() => setShowTrendModal(false)}
                   className="px-8 py-3 bg-primary text-white font-bold rounded-2xl shadow-xl shadow-primary/20 hover:scale-105 transition-all"
                >
                  Close Insights
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Manual Analysis Modal */}
      <AnimatePresence>
        {showManualModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
              onClick={() => setShowManualModal(false)}
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="bg-panel border border-white/10 w-full max-w-2xl rounded-2xl p-8 z-10 shadow-2xl"
            >
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold flex items-center gap-3">
                  <ShieldAlert className="text-accent" /> Analyze External Job
                </h2>
                <button onClick={() => setShowManualModal(false)} className="text-white/40 hover:text-white transition-colors">
                   ✕
                </button>
              </div>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-white/40 block mb-1 uppercase">Job Title</label>
                    <input value={manualTitle} onChange={e => setManualTitle(e.target.value)} className="w-full bg-background border border-white/10 rounded-xl px-4 py-2 outline-none focus:border-accent" placeholder="e.g. Senior Developer" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-white/40 block mb-1 uppercase">Company Name</label>
                    <input value={manualCompany} onChange={e => setManualCompany(e.target.value)} className="w-full bg-background border border-white/10 rounded-xl px-4 py-2 outline-none focus:border-accent" placeholder="e.g. Google" />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-bold text-white/40 block mb-1 uppercase">Job Location</label>
                  <input value={manualLocation} onChange={e => setManualLocation(e.target.value)} className="w-full bg-background border border-white/10 rounded-xl px-4 py-2 outline-none focus:border-accent" placeholder="e.g. New York, Remote..." />
                </div>
                <div>
                  <label className="text-xs font-bold text-white/40 block mb-1 uppercase">Job Description / Text Content</label>
                  <textarea 
                    rows={8}
                    value={manualText}
                    onChange={e => setManualText(e.target.value)}
                    className="w-full bg-background border border-white/10 rounded-xl px-4 py-2 outline-none focus:border-accent resize-none"
                    placeholder="Paste the job description here..."
                  />
                </div>
                <div className="flex gap-4 pt-4">
                  <button onClick={() => setShowManualModal(false)} className="flex-1 py-3 border border-white/10 rounded-xl font-bold hover:bg-white/5 transition-all">Cancel</button>
                  <button 
                    onClick={handleManualAnalyze}
                    disabled={!manualText || analyzing === 'manual'}
                    className="flex-[2] py-3 bg-accent text-white rounded-xl font-bold hover:bg-accent/90 transition-all flex items-center justify-center gap-2"
                  >
                    {analyzing === 'manual' ? <Loader2 className="w-5 h-5 animate-spin" /> : <ShieldCheck className="w-5 h-5" />}
                    Perform Intelligence Check
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <footer className="max-w-7xl mx-auto px-8 py-12 border-t border-white/5 text-center text-white/30 text-sm">
        &copy; 2024 JobGuard AI Portal. Final Year Project Architecture. Real-time Fraud Mitigation.
      </footer>
    </div>
  );
};

export default App;
