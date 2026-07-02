"use client";

import React, { useState, useEffect, useRef } from "react";
import { Camera, Trash2, Search, TrendingUp, DollarSign, Layers, Loader2, RefreshCw, Smartphone } from "lucide-react";
import Tesseract from "tesseract.js";

export default function PokemonTracker() {
  const [collection, setCollection] = useState([]);
  const [searchName, setSearchName] = useState("");
  const [searchNumber, setSearchNumber] = useState("");
  const [loading, setLoading] = useState(false);
  const [scanStatus, setScanStatus] = useState(""); 
  const [error, setError] = useState(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [capturedImage, setCapturedImage] = useState(null);
  const [rawScannedText, setRawScannedText] = useState(""); 

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);

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

  // OCR Processing Logic
  const processImageText = async (imageSrc) => {
    setScanStatus("Analyzing text layout...");
    setRawScannedText("");
    setSearchName("");
    setSearchNumber("");
    
    try {
      const result = await Tesseract.recognize(
        imageSrc,
        "eng",
        { logger: m => {
          if (m.status === "recognizing text") {
            setScanStatus(`Reading card: ${Math.floor(m.progress * 100)}%`);
          }
        }}
      );

      const extractedText = result.data.text;
      setRawScannedText(extractedText);

      if (!extractedText || extractedText.trim().length < 5) {
        setScanStatus("");
        setError("Could not read any clear text. Try placing the card closer to the center template outline.");
        return;
      }

      const lines = extractedText.split("\n").map(line => line.trim()).filter(line => line.length > 2);
      
      // Parse Card Number
      let foundNumber = "";
      const cardNumberRegex = /(\d+)\s*[\/\s]\s*(\d+)/;
      const numberMatch = extractedText.match(cardNumberRegex);
      if (numberMatch) {
        foundNumber = numberMatch[1]; 
      }

      // Parse Card Name
      let foundName = "";
      const skipWords = ["hp", "basic", "stage", "trainer", "energy", "evolves", "pokemon", "item", "supporter", "vmax", "vstar", "illus", "rule"];
      
      for (const line of lines) {
        const cleanLine = line.toLowerCase();
        if (skipWords.some(word => cleanLine.includes(word)) || /^\d+$/.test(line)) {
          continue;
        }
        foundName = line.replace(/[^a-zA-Z\s-]/g, "").trim(); 
        if (foundName.length > 2) break;
      }

      setSearchName(foundName || "");
      setSearchNumber(foundNumber || "");
      setScanStatus("");
      
      if (!foundName && !foundNumber) {
        setError("Text detected, but no valid card fields could be recognized. Feel free to adjust manually.");
      } else {
        setError("Card text parsed! Review fields below before saving.");
      }
    } catch (ocrError) {
      console.error(ocrError);
      setScanStatus("");
      setError("The scanning engine encountered an error. Please enter details manually.");
    }
  };

  // 1. HIGH-RELIABILITY INLINE LIVE CAMERA STREAM (Shows template border on page)
  const toggleLiveCamera = async () => {
    if (cameraActive) {
      stopLiveCamera();
    } else {
      try {
        setCapturedImage(null);
        setError("Waking up device camera...");
        
        // Mobile-friendly relaxed constraints to bypass multi-lens system freezes
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { 
            facingMode: "environment" 
          },
        });
        
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          streamRef.current = stream;
          setCameraActive(true);
          setError(null);
        }
      } catch (err) {
        console.error("Inline camera stream failed:", err);
        setError("Could not open inline video stream. Use the alternative 'Launch Phone Camera App' button below.");
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

  const captureLiveFrame = async () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const context = canvas.getContext("2d");

      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      context.drawImage(video, 0, 0, canvas.width, canvas.height);

      const imageDataUrl = canvas.toDataURL("image/png");
      setCapturedImage(imageDataUrl);
      stopLiveCamera();
      
      await processImageText(imageDataUrl);
    }
  };

  // 2. OFF-PAGE NATIVE SYSTEM CAMERA FALLBACK (Launches external Android App)
  const handleNativeCameraCapture = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setError(null);

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64Image = reader.result;
      setCapturedImage(base64Image);
      setLoading(false);
      await processImageText(base64Image);
    };
    reader.readAsDataURL(file);
  };

  const handleSearchAndAdd = async (e) => {
    e.preventDefault();
    if (!searchName) {
      setError("Please input a card name to perform an API check.");
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
        setRawScannedText("");
      } else {
        setError(`No exact matches found for "${searchName}". Please check the spelling.`);
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

  const clearStagedImage = () => {
    setCapturedImage(null);
    setSearchName("");
    setSearchNumber("");
    setRawScannedText("");
    setError(null);
  };

  const totalValue = collection.reduce((sum, card) => sum + (card.price || 0), 0);

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 font-sans p-4 md:p-8">
      <header className="max-w-6xl mx-auto mb-8 flex flex-col md:flex-row justify-between items-center border-b border-slate-800 pb-6 gap-4">
        <div>
          <h1 className="text-3xl font-extrabold bg-gradient-to-r from-yellow-400 to-amber-500 bg-clip-text text-transparent">
            PokéVault
          </h1>
          <p className="text-slate-400 text-sm mt-1">AI Template Scanner & Value Tracker</p>
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
              <Camera size={20} className="text-amber-400" /> Interactive Lens Viewport
            </h2>

            {/* Embedded Screen Window Container */}
            <div className="relative w-full aspect-[4/3] bg-black rounded-xl overflow-hidden mb-4 border border-slate-700 flex items-center justify-center">
              <canvas ref={canvasRef} className="hidden" />

              <input
                type="file"
                ref={fileInputRef}
                accept="image/*"
                capture="environment"
                onChange={handleNativeCameraCapture}
                className="hidden"
              />

              {/* Status Loader Screen */}
              {scanStatus && (
                <div className="absolute inset-0 bg-slate-950/80 z-20 flex flex-col items-center justify-center p-4 text-center">
                  <Loader2 className="w-8 h-8 text-amber-400 animate-spin mb-2" />
                  <p className="text-sm font-semibold text-amber-400">{scanStatus}</p>
                </div>
              )}

              {/* 1. True Inline Live Streaming view box */}
              {cameraActive && (
                <>
                  <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
                  {/* The On-Page CSS Outline Guide Box */}
                  <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/30 pointer-events-none">
                    <div className="w-44 aspect-[2.5/3.5] border-4 border-dashed border-amber-400 rounded-xl flex flex-col items-center justify-center bg-transparent shadow-[0_0_0_9999px_rgba(0,0,0,0.5)]">
                      <span className="text-[10px] text-amber-400 font-bold tracking-widest bg-slate-900/90 px-2 py-0.5 rounded shadow">ALIGN CARD</span>
                    </div>
                  </div>
                </>
              )}

              {/* 2. Photo Processing Frame Display */}
              {!cameraActive && capturedImage && (
                <div className="relative w-full h-full">
                  <img src={capturedImage} alt="Scanned card review" className="w-full h-full object-contain bg-slate-950" />
                  <button 
                    type="button" 
                    onClick={clearStagedImage}
                    className="absolute top-2 right-2 bg-slate-900/90 hover:bg-slate-800 text-slate-200 px-2 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 border border-slate-700 shadow"
                  >
                    <RefreshCw size={12} /> Reset Canvas
                  </button>
                </div>
              )}

              {/* 3. Empty Base Placeholder Screen */}
              {!cameraActive && !capturedImage && (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-500 p-6 text-center">
                  <p className="text-sm font-semibold">Inline Scanner Inactive</p>
                  <p className="text-xs mt-1 text-slate-600">Tap 'Start Inline Scanner' to display the card layout alignment guide directly on this page.</p>
                </div>
              )}
            </div>

            {/* Reorganized Controller Buttons */}
            <div className="flex flex-col gap-2 mb-6">
              
              {/* PRIMARY OPTION: Start Inline Camera Shutter */}
              <button
                type="button"
                onClick={toggleLiveCamera}
                className={`w-full font-bold py-3 px-4 rounded-xl text-sm transition-all duration-200 shadow-md flex items-center justify-center gap-2 ${
                  cameraActive
                    ? "bg-rose-600 hover:bg-rose-700 text-white"
                    : "bg-gradient-to-r from-yellow-400 to-amber-500 text-slate-950 hover:from-yellow-500 hover:to-amber-600"
                }`}
              >
                <Camera size={18} />
                {cameraActive ? "Turn Off Inline Scanner" : "Start Inline Scanner (With Border Guide)"}
              </button>

              {/* Snapshot trigger button for inline stream mode */}
              {cameraActive && (
                <button
                  type="button"
                  onClick={captureLiveFrame}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 px-4 rounded-xl text-xs transition-colors shadow-md uppercase tracking-wider"
                >
                  Snap Photo Inside Border
                </button>
              )}

              {/* BACKUP OPTION: System Level Shutter Button */}
              {!cameraActive && (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full bg-slate-800 border border-slate-700 hover:bg-slate-700 text-slate-300 font-medium py-2 px-4 rounded-xl text-xs transition-colors mt-2 flex items-center justify-center gap-2"
                >
                  <Smartphone size={14} />
                  Backup: Launch Phone Camera App (No Border)
                </button>
              )}
            </div>

            {/* Review Form */}
            <form onSubmit={handleSearchAndAdd} className="space-y-4 pt-4 border-t border-slate-700">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                  Card Name (Auto-Detected)
                </label>
                <input
                  type="text"
                  placeholder="Awaiting text scan extraction..."
                  value={searchName}
                  onChange={(e) => setSearchName(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-amber-500 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                  Collector Number (Auto-Detected)
                </label>
                <input
                  type="text"
                  placeholder="e.g., 4"
                  value={searchNumber}
                  onChange={(e) => setSearchNumber(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-amber-500 text-sm"
                />
              </div>

              {error && (
                <div className="bg-amber-500/10 border border-amber-500/20 text-amber-400 p-3 rounded-xl text-xs leading-relaxed">
                  {error}
                </div>
              )}

              {rawScannedText && (
                <div className="bg-slate-900 border border-slate-700 p-2.5 rounded-xl">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Raw Detected Text Output:</p>
                  <p className="text-[11px] text-slate-400 font-mono line-clamp-2 overflow-hidden italic">
                    "{rawScannedText.trim()}"
                  </p>
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !!scanStatus}
                className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-bold py-3 px-4 rounded-xl text-sm shadow-md transition-all duration-200 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <Search size={16} />
                {loading ? "Adding to Vault Portfolio..." : "Confirm & Save Card"}
              </button>
            </form>
          </div>
        </div>

        {/* Portfolio view column */}
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-xl font-bold flex items-center gap-2 text-slate-200">
            <TrendingUp size={20} className="text-emerald-400" /> Collected Cards Archive
          </h2>

          {collection.length === 0 ? (
            <div className="bg-slate-800/40 border border-dashed border-slate-700 rounded-2xl p-12 text-center text-slate-500">
              <p className="text-base font-medium">Your PokéVault is currently empty.</p>
              <p className="text-xs mt-1">Use the active inline scanner grid view to process real physical card objects.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {collection.map((card) => (
                <div
                  key={card.id}
                  className="bg-slate-800 border border-slate-700 rounded-2xl p-4 flex gap-4 items-center relative overflow-hidden shadow-md"
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