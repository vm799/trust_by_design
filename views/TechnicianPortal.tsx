
import React, { useState, useRef, useEffect } from 'react';
import Layout from '../components/Layout';
import { useParams, useNavigate } from 'react-router-dom';
import { Job, Photo } from '../types';

const TechnicianPortal: React.FC<{ jobs: Job[], onUpdateJob: (j: Job) => void }> = ({ jobs, onUpdateJob }) => {
  const { jobId } = useParams();
  const navigate = useNavigate();
  const job = jobs.find(j => j.id === jobId);
  
  const [step, setStep] = useState(1);
  const [photos, setPhotos] = useState<Photo[]>(job?.photos || []);
  const [notes, setNotes] = useState(job?.notes || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawing = useRef(false);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    if (step === 2 && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.strokeStyle = '#020617';
        ctx.lineWidth = 3;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
      }
      const resize = () => {
        canvas.width = canvas.parentElement?.clientWidth || 300;
        canvas.height = 200;
      };
      resize();
    }
  }, [step]);

  if (!job) return (
    <div className="flex items-center justify-center min-h-screen bg-slate-950 p-6 text-center">
      <div className="space-y-4">
        <h2 className="text-3xl font-black text-white italic tracking-tighter uppercase">Invalid Link</h2>
        <p className="text-slate-500 font-medium">This job link has expired or the evidence session was terminated. Contact dispatch.</p>
        <button onClick={() => navigate('/home')} className="px-8 py-3 bg-primary text-white rounded-xl font-black uppercase tracking-widest shadow-xl shadow-primary/20">Return to Safety</button>
      </div>
    </div>
  );

  const addPhoto = () => {
    const placeholderImages = [
      'https://images.unsplash.com/photo-1581094288338-2314dddb7ecb?q=80&w=800',
      'https://images.unsplash.com/photo-1504328345606-18bbc8c9d7d1?q=80&w=800',
      'https://images.unsplash.com/photo-1621905252507-b354bcadcabc?q=80&w=800'
    ];
    const randomIndex = Math.floor(Math.random() * placeholderImages.length);
    
    const newPhoto: Photo = {
      id: Math.random().toString(36).substr(2, 9),
      url: placeholderImages[randomIndex],
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      verified: true
    };
    setPhotos([...photos, newPhoto]);
  };

  const handleFinalSubmit = () => {
    setIsSubmitting(true);
    const updated: Job = {
      ...job,
      status: 'Submitted',
      photos,
      notes,
      signature: canvasRef.current?.toDataURL() || null,
      completedAt: new Date().toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })
    };
    
    // In a real app, if offline, we'd store in IndexedDB and sync later
    setTimeout(() => {
      onUpdateJob(updated);
      setIsSubmitting(false);
      setStep(4);
    }, 2000);
  };

  if (step === 4) {
    return (
      <Layout isAdmin={false}>
        <div className="flex flex-col items-center justify-center min-h-[70vh] text-center space-y-6 animate-in">
          <div className="size-24 rounded-full bg-success/10 flex items-center justify-center text-success border border-success/20 shadow-2xl shadow-success/10">
            <span className="material-symbols-outlined text-6xl">verified</span>
          </div>
          <div className="space-y-2">
            <h2 className="text-4xl font-black text-white italic tracking-tighter uppercase leading-none">Evidence <br/> Sealed</h2>
            <p className="text-slate-400 text-sm max-w-[240px] mx-auto font-medium">Authenticated logs for <span className="text-white">{job.client}</span> have been successfully transmitted.</p>
          </div>
          <button onClick={() => navigate('/home')} className="w-full py-4 bg-white/5 px-8 rounded-2xl font-black text-xs uppercase tracking-[0.2em] border border-white/5 hover:bg-white/10 transition-all mt-8">Exit Capture Hub</button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout isAdmin={false}>
      <div className="space-y-8 pb-40">
        {/* Offline Alert */}
        {isOffline && (
          <div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-2xl flex items-center gap-3 animate-pulse">
            <span className="material-symbols-outlined text-amber-500">wifi_off</span>
            <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest">Offline Mode Active • Evidence Queueing</p>
          </div>
        )}

        {/* Info Header */}
        <div className="space-y-1">
           <div className="flex justify-between items-start">
              <h2 className="text-[10px] font-black text-primary uppercase tracking-widest">Job Reference: {job.id}</h2>
              <span className="text-[8px] font-black text-slate-500 uppercase px-2 py-0.5 border border-white/5 rounded-full">Step {step} of 3</span>
           </div>
           <h3 className="text-2xl font-black text-white italic uppercase tracking-tighter">{job.title}</h3>
           <p className="text-slate-500 text-xs font-medium">{job.address}</p>
        </div>

        {/* Progress Stepper */}
        <div className="flex gap-2">
          {[1, 2, 3].map(s => (
            <div key={s} className={`h-1 flex-1 rounded-full transition-all ${step >= s ? 'bg-primary' : 'bg-slate-800'}`} />
          ))}
        </div>

        {/* Step 1: Capture */}
        {step === 1 && (
          <div className="space-y-8 animate-in">
            <header className="space-y-2">
               <h2 className="text-3xl font-black tracking-tighter uppercase leading-none">Operational <br/> Evidence</h2>
               <p className="text-slate-400 text-sm font-medium">Capture high-resolution evidence of work completed.</p>
            </header>
            
            <div className="grid grid-cols-2 gap-4">
              <button onClick={addPhoto} className="aspect-square rounded-3xl border-2 border-dashed border-primary/40 bg-primary/5 flex flex-col items-center justify-center gap-3 text-primary group active:scale-95 transition-all shadow-inner">
                <span className="material-symbols-outlined text-4xl group-hover:scale-110 transition-transform">add_a_photo</span>
                <span className="text-[10px] font-black uppercase tracking-widest">Snap Proof</span>
              </button>
              {photos.map(p => (
                <div key={p.id} className="aspect-square rounded-3xl bg-slate-900 border border-white/5 overflow-hidden relative shadow-2xl group animate-in">
                  <img src={p.url} className="w-full h-full object-cover grayscale-[30%] group-hover:grayscale-0 transition-all" alt="Proof" />
                  <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-slate-950/90 to-transparent"></div>
                  <div className="absolute bottom-3 left-3 right-3 flex justify-between items-center">
                    <span className="text-[8px] text-white font-black uppercase flex items-center gap-1"><span className="size-1.5 bg-success rounded-full"></span> SEALED</span>
                    <button onClick={() => setPhotos(photos.filter(ph => ph.id !== p.id))} className="text-white/40 hover:text-red-400 transition-colors"><span className="material-symbols-outlined text-xs">delete</span></button>
                  </div>
                </div>
              ))}
            </div>

            <button 
              disabled={photos.length === 0}
              onClick={() => setStep(2)}
              className="w-full py-5 bg-primary rounded-[2rem] font-black text-white shadow-2xl shadow-primary/30 disabled:opacity-30 flex items-center justify-center gap-3 transition-all active:scale-95 text-lg"
            >
              Final Sign-off
              <span className="material-symbols-outlined">arrow_forward</span>
            </button>
          </div>
        )}

        {/* Step 2: Signature */}
        {step === 2 && (
          <div className="space-y-8 animate-in">
            <header className="space-y-2">
               <h2 className="text-3xl font-black tracking-tighter uppercase leading-none">Identity <br/> Verification</h2>
               <p className="text-slate-400 text-sm font-medium">Client digital attestation for service completion.</p>
            </header>

            <div className="bg-slate-50 rounded-[2.5rem] p-6 overflow-hidden border-4 border-slate-900 shadow-2xl relative">
               <p className="text-[8px] font-black text-slate-300 absolute top-4 left-0 right-0 text-center uppercase tracking-widest pointer-events-none">JobProof Secure Signing Terminal</p>
               <div className="h-48 relative border-2 border-dashed border-slate-200 rounded-3xl overflow-hidden bg-white/50">
                  <canvas 
                    ref={canvasRef} 
                    className="absolute inset-0 touch-none cursor-crosshair"
                    onMouseDown={(e) => {
                       isDrawing.current = true;
                       const ctx = canvasRef.current?.getContext('2d');
                       if (ctx) {
                          ctx.beginPath();
                          ctx.moveTo(e.nativeEvent.offsetX, e.nativeEvent.offsetY);
                       }
                    }}
                    onMouseMove={(e) => {
                       if (!isDrawing.current) return;
                       const ctx = canvasRef.current?.getContext('2d');
                       if (ctx) {
                          ctx.lineTo(e.nativeEvent.offsetX, e.nativeEvent.offsetY);
                          ctx.stroke();
                       }
                    }}
                    onMouseUp={() => (isDrawing.current = false)}
                    onTouchStart={(e) => {
                       isDrawing.current = true;
                       const rect = canvasRef.current?.getBoundingClientRect();
                       if (rect) {
                          const touch = e.touches[0];
                          const ctx = canvasRef.current?.getContext('2d');
                          if (ctx) {
                             ctx.beginPath();
                             ctx.moveTo(touch.clientX - rect.left, touch.clientY - rect.top);
                          }
                       }
                    }}
                    onTouchMove={(e) => {
                       if (!isDrawing.current) return;
                       const rect = canvasRef.current?.getBoundingClientRect();
                       if (rect) {
                          const touch = e.touches[0];
                          const ctx = canvasRef.current?.getContext('2d');
                          if (ctx) {
                             ctx.lineTo(touch.clientX - rect.left, touch.clientY - rect.top);
                             ctx.stroke();
                          }
                       }
                       e.preventDefault();
                    }}
                    onTouchEnd={() => (isDrawing.current = false)}
                  ></canvas>
                  <button onClick={() => {
                     const ctx = canvasRef.current?.getContext('2d');
                     ctx?.clearRect(0, 0, canvasRef.current?.width || 0, canvasRef.current?.height || 0);
                  }} className="absolute bottom-4 right-4 text-[9px] font-black text-slate-400 bg-white px-3 py-1 rounded-full border border-slate-100 hover:text-red-500 shadow-sm transition-all uppercase">Reset</button>
               </div>
            </div>

            <div className="flex gap-4">
              <button onClick={() => setStep(1)} className="flex-1 py-4 bg-slate-900 border border-white/5 rounded-2xl font-black text-[10px] uppercase tracking-widest text-white">Back</button>
              <button onClick={() => setStep(3)} className="flex-[2] py-4 bg-primary rounded-2xl font-black text-xs uppercase tracking-widest text-white shadow-xl shadow-primary/20">Review Seal</button>
            </div>
          </div>
        )}

        {/* Step 3: Review */}
        {step === 3 && (
          <div className="space-y-8 animate-in">
            <header className="space-y-2">
               <h2 className="text-3xl font-black tracking-tighter uppercase leading-none">Review & <br/> Final Seal</h2>
               <p className="text-slate-400 text-sm font-medium">Verify data integrity before immutable upload.</p>
            </header>

            <div className="bg-slate-900 border border-white/5 p-6 rounded-[2rem] space-y-4">
               <div className="flex items-center justify-between">
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Evidence Counts</p>
                  <span className="text-[10px] font-black text-white">{photos.length} Photos Captured</span>
               </div>
               <div className="h-px bg-white/5"></div>
               <div className="space-y-2">
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Operator Notes</p>
                  <textarea 
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Briefly describe site conditions or repair actions..."
                    className="w-full bg-slate-800 border-slate-700 rounded-xl p-4 text-white text-sm min-h-[100px] focus:ring-1 focus:ring-primary outline-none transition-all placeholder:text-slate-600"
                  />
               </div>
            </div>

            <button 
              onClick={handleFinalSubmit}
              disabled={isSubmitting}
              className="w-full py-6 bg-success rounded-[2rem] font-black text-xl tracking-tighter text-white shadow-2xl shadow-success/30 flex items-center justify-center gap-3 transition-all active:scale-95"
            >
              {isSubmitting ? (
                 <>
                    <div className="size-6 border-4 border-white/30 border-t-white rounded-full animate-spin"></div>
                    <span className="uppercase text-sm tracking-widest italic">Syncing to Hub...</span>
                 </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-3xl">verified</span>
                  AUTHENTICATE & SEAL
                </>
              )}
            </button>
            <p className="text-center text-[8px] text-slate-500 font-black uppercase tracking-[0.3em]">Encrypted Transmission Active</p>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default TechnicianPortal;
