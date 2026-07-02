"use client";

import React, { useState, useEffect, useRef } from "react";
import { Camera, Trash2, Search, TrendingUp, DollarSign, Layers, Upload } from "lucide-react";

export default function PokemonTracker() {
  const [collection, setCollection] = useState([]);
  const [searchName, setSearchName] = useState("");
  const [searchNumber, setSearchNumber] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [capturedImage, setCapturedImage] = useState(null);

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const canvasRef = useRef(null);
  const fileInputRef = useRef(null); // Reference for the native camera loader

  useEffect(() => {
    const savedCollection = localStorage.getItem("pokemon_collection");
    if (savedCollection) {
      try {
        setCollection(JSON.parse(savedCollection));
      } catch (e) {
        console.error("Error parsing collection from localStorage", e);
      }
    }
  }, []);

  const saveToLocalStorage = (newCollection) => {
    setCollection(newCollection);
    localStorage.setItem("pokemon_collection", JSON.stringify(newCollection));
  };

  // 1. High-Reliability Mobile Native Camera Capture
  const handleNativeCameraCapture = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setError(null);

    const reader = new FileReader();
    reader.onloadend = () => {
      setCapturedImage(reader.result);
      
      // Auto-populate target search values (Simulating OCR scan parser)
      setSearchName("Charizard");
      setSearchNumber("4");
      
      setLoading(false);
      setError("Photo imported successfully! Tap 'Search & Add Card' below to pull live market value data.");
    };
    reader.onerror = () => {
      setError("Failed to read the captured image file.");
      setLoading(false);
    };
    reader.readAsDataURL(file);
  };

  // 2. Standard Browser Live Video Streaming (Fallback / Desktop Mode)
  const toggleLiveCamera = async () => {
    if (cameraActive) {
      stopLiveCamera();
    } else {
      try {
        setCapturedImage(null);
        setError("Attempting to connect to live video feed...");
        
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });
        
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          streamRef.current = stream;
          setCameraActive(true);
          setError(null);
        }
      } catch (err) {
        console.warn("Live streaming failed, shifting to native system camera access.", err);
        setError("Live streaming unavailable on this browser context. Please use the 'Take Photo with Phone' option below.");
        setCameraActive(false);
      }
    }
  };

  const stopLiveCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  };

  const captureLiveFrame = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const context = canvas.getContext("2d");

      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      context.drawImage(video, 0, 0, canvas.width, canvas.height);

      setCapturedImage(canvas.toDataURL("image/png"));
      setSearchName("Charizard");
      setSearchNumber("4");
      stopLiveCamera();
      setError("Snapshot frozen! Tap 'Search & Add Card' below to pull live data.");
    }
  };

  const handleSearchAndAdd = async (e) => {
    e.preventDefault();
    if (!searchName) {
      setError("Please enter at least a card name.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      let query = `name:"${searchName}"`;
      if (searchNumber) {
        query += ` number:"${searchNumber}"`;
      }

      const response = await fetch(
        `https://api.pokemontcg.io/v2/cards?q=${encodeURIComponent(query)}&pageSize=1`
      );
      const data = await response.json();

      if (data.data && data.data.length > 0) {
        const card = data.data[0];
        
        const marketPrice = 
          card.tcgplayer?.prices?.holofoil?.market || 
          card.tcgplayer?.prices?.normal?.market || 
          card.cardmarket?.prices?.averageSell || 
          0;

        const newCardInstance = {
          id: `${card.id}-${Date.now()}`,
          apiId: card.id,
          name: card.name,
          supertype: card.supertype,
          subtypes: card.subtypes ? card.subtypes.join(", ") : "N/A",
          number: card.number,
          set: card.set.name,
          image: card.images.small,
          price: marketPrice,
          dateAdded: new Date().toLocaleDateString(),
        };

        const updatedCollection = [newCardInstance, ...collection];
        saveToLocalStorage(updatedCollection);

        setSearchName("");
        setSearchNumber("");
        setCapturedImage(null);
      } else {
        setError("No exact card matched. Try checking the spelling or number format.");
      }
    } catch (err) {
      setError("Failed to fetch data from Pokémon TCG API. Check your internet connection.");
    } finally {
      setLoading(false);
    }
  };

  const removeCard = (id) => {
    const updatedCollection = collection.filter((card) => card.id !== id);
    saveToLocalStorage(updatedCollection);
  };

  const totalValue = collection.reduce((sum, card) => sum + (card.price || 0), 0);

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 font-sans p-4 md:p-8">
      {/* Header Banner */}
      <header className="max-w-6xl mx-auto mb-8 flex flex-col md:flex-row justify-between items-center border-b border-slate-800 pb-6 gap-4">
        <div>
          <h1 className="text-3xl font-extrabold bg-gradient-to-r from-yellow-400 to-amber-500 bg-clip-text text-transparent">
            PokéVault
          </h1>
          <p className="text-slate-400 text-sm mt-1">Mobile Card Scanner & Portfolio Value Tracker</p>
        </div>

        <div className="flex gap-4">
          <div className="bg-slate-800 border border-slate-700 px-4 py-2 rounded-xl flex items-center gap-3 shadow-lg">
            <div className="p-2 bg-amber-500/10 rounded-lg text-amber-400">
              <Layers size={20} />
            </div>
            <div>
              <p className="text-xs text-slate-400 font-medium">Total Cards</p>
              <p className="text-lg font-bold">{collection.length}</p>
            </div>
          </div>
          <div className="bg-slate-800 border border-slate-700 px-4 py-2 rounded-xl flex items-center gap-3 shadow-lg">
            <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-400">
              <DollarSign size={20} />
            </div>
            <div>
              <p className="text-xs text-slate-400 font-medium">Portfolio Value</p>
              <p className="text-lg font-bold text-emerald-400">${totalValue.toFixed(2)}</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-5 shadow-xl">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-slate-200">
              <Camera size={20} className="text-amber-400" /> Card Capture Panel
            </h2>

            {/* Viewfinder Window Frame */}
            <div className="relative w-full aspect-[4/3] bg-black rounded-xl overflow-hidden mb-4 border border-slate-700 flex items-center justify-center">
              <canvas ref={canvasRef} className="hidden" />

              {/* Hidden System Device Camera Portal Hook */}
              <input
                type="file"
                ref={fileInputRef}
                accept="image/*"
                capture="environment"
                onChange={handleNativeCameraCapture}
                className="hidden"
              />

              {/* 1. Live Video Element */}
              {cameraActive && (
                <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
              )}

              {/* 2. Photo Processing Display Sheet */}
              {!cameraActive && capturedImage && (
                <img src={capturedImage} alt="Scanned file display" className="w-full h-full object-contain bg-slate-950" />
              )}

              {/* 3. Standard Static Blank State */}
              {!cameraActive && !capturedImage && (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-500 p-4 text-center">
                  <p className="text-sm font-semibold">No Image Staged</p>
                  <p className="text-xs mt-1 text-slate-600">Use the action buttons below to take a photo</p>
                </div>
              )}
            </div>

            {/* Core Operational Controls */}
            <div className="flex flex-col gap-2 mb-6">
              {/* Ironclad Mobile Capture Shutter Button */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold py-3 px-4 rounded-xl text-sm transition-colors duration-200 shadow-md flex items-center justify-center gap-2"
              >
                <Camera size={18} />
                Take Photo with Phone Camera
              </button>

              {/* Live Streaming Mode Toggle Option */}
              <button
                type="button"
                onClick={toggleLiveCamera}
                className={`py-2 px-4 rounded-xl font-medium text-xs transition-colors mt-1 border flex items-center justify-center gap-2 ${
                  cameraActive
                    ? "bg-rose-600/20 border-rose-500/40 text-rose-400 hover:bg-rose-600/30"
                    : "bg-slate-900 border-slate-700 text-slate-400 hover:bg-slate-700/40"
                }`}
              >
                {cameraActive ? "Turn Off Live Stream Feed" : "Toggle Live Stream Video Mode"}
              </button>

              {cameraActive && (
                <button
                  type="button"
                  onClick={captureLiveFrame}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 px-4 rounded-xl text-xs mt-1 transition-colors"
                >
                  Snap Frame From Active Stream
                </button>
              )}
            </div>

            {/* Form Fields Mapping Layer */}
            <form onSubmit={handleSearchAndAdd} className="space-y-4 pt-4 border-t border-slate-700">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                  Card Name
                </label>
                <input
                  type="text"
                  placeholder="e.g., Charizard"
                  value={searchName}
                  onChange={(e) => setSearchName(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                  Collector Card Number (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g., 4"
                  value={searchNumber}
                  onChange={(e) => setSearchNumber(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500 text-sm"
                />
              </div>

              {error && (
                <div className="bg-amber-500/10 border border-amber-500/20 text-amber-400 p-3 rounded-xl text-xs leading-relaxed">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-yellow-400 to-amber-500 hover:from-yellow-500 hover:to-amber-600 text-slate-950 font-bold py-3 px-4 rounded-xl text-sm shadow-md transition-all duration-200 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <Search size={16} />
                {loading ? "Connecting to TCG Network..." : "Search & Add Card"}
              </button>
            </form>
          </div>
        </div>

        {/* Inventory Portfolio Display Section */}
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-xl font-bold flex items-center gap-2 text-slate-200">
            <TrendingUp size={20} className="text-emerald-400" /> Collected Cards Archive
          </h2>

          {collection.length === 0 ? (
            <div className="bg-slate-800/40 border border-dashed border-slate-700 rounded-2xl p-12 text-center text-slate-500">
              <p className="text-base font-medium">Your PokéVault is currently empty.</p>
              <p className="text-xs mt-1">Activate the shutter framework above to start compiling your card assets.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {collection.map((card) => (
                <div
                  key={card.id}
                  className="bg-slate-800 border border-slate-700 rounded-2xl p-4 flex gap-4 items-center relative overflow-hidden shadow-md hover:border-slate-600 transition-colors"
                >
                  <div className="w-20 h-28 relative flex-shrink-0 bg-slate-900 rounded-lg overflow-hidden border border-slate-700">
                    <img src={card.image} alt={card.name} className="w-full h-full object-contain object-center scale-105" loading="lazy" />
                  </div>

                  <div className="flex-1 min-w-0 pr-6">
                    <h3 className="font-bold text-slate-100 truncate text-base leading-snug">{card.name}</h3>
                    <p className="text-xs text-slate-400 font-medium mt-0.5">{card.set} • #{card.number}</p>
                    <p className="text-[11px] bg-slate-700/60 inline-block text-slate-300 px-2 py-0.5 rounded-md font-mono mt-2">{card.subtypes}</p>
                    <div className="mt-3 flex items-baseline gap-1">
                      <span className="text-xs font-semibold text-slate-400">Value:</span>
                      <span className="text-lg font-black text-emerald-400">${card.price ? card.price.toFixed(2) : "0.00"}</span>
                    </div>
                  </div>

                  <button
                    onClick={() => removeCard(card.id)}
                    className="absolute top-3 right-3 text-slate-500 hover:text-rose-400 transition-colors p-1.5 rounded-lg hover:bg-slate-700/50"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}