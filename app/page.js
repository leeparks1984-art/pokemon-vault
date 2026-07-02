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

  // Upgraded OCR Text Filter Engine
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
            setScanStatus(`Reading card data: ${Math.floor(m.progress * 100)}%`);
          }
        }}
      );

      const extractedText = result.data.text;
      setRawScannedText(extractedText);

      if (!extractedText || extractedText.trim().length < 3) {
        setScanStatus("");
        setError("Could not isolate crisp text details. Hold the card completely still inside the guide outline.");
        return;
      }

      // Breakdown line filtering matrix
      const lines = extractedText.split("\n")
        .map(line => line.trim())
        .filter(line => line.length > 1);
      
      // Parse Card Number Fraction (Checks for structural formats like 042/198, 4/102, or 121/200)
      let foundNumber = "";
      const cardNumberRegex = /(\d+)\s*[\/\s-]\s*(\d+)/;
      const numberMatch = extractedText.match(cardNumberRegex);
      if (numberMatch) {
        foundNumber = numberMatch[1]; 
      }

      // Parse Card Identity Name (Forage top lines, avoiding standard system text clutter)
      let foundName = "";
      const skipWords = ["hp", "basic", "stage", "trainer", "energy", "evolves", "pokemon", "item", "supporter", "vmax", "vstar", "illus", "rule", "weakness", "resistance", "retreat"];
      
      for (const line of lines) {
        const cleanLine = line.toLowerCase();
        // Skip metadata lines, gameplay descriptions, or straight numeric vectors
        if (skipWords.some(word => cleanLine.includes(word)) || /^\d+$/.test(line) || cleanLine.length < 3) {
          continue;
        }
        // Extract alpha-specific card name strings cleanly
        foundName = line.replace(/[^a-zA-Z\s-]/g, "").trim(); 
        if (foundName.length > 2) break;
      }

      // Set input states to newly processed data points
      setSearchName(foundName || "");
      setSearchNumber(foundNumber || "");
      setScanStatus("");
      
      if (!foundName && !foundNumber) {
        setError("Card texture read, but no database fields matched. Please fine-tune details manually below.");
      } else {
        setError("AI Matrix parsing complete! Double check the fields below before adding to the archive.");
      }
    } catch (ocrError) {
      console.error(ocrError);
      setScanStatus("");
      setError("Text processing timed out. Feel free to type card markers directly below.");
    }
  };

  const toggleLiveCamera = async () => {
    if (cameraActive) {
      stopLiveCamera();
      return;
    }

    setCapturedImage(null);
    setError("Waking up camera...");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" }
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
        setCameraActive(true);
        setError(null);
      } else {
        stream.getTracks().forEach(track => track.stop());
        setError("Viewfinder connection issue. Please refresh page.");
      }
    } catch (err) {
      console.error(err);
      setError("Inline camera streaming blocked. Use the phone camera app backup option below.");
      setCameraActive(false);
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

  // HIGH-PERFORMANCE PREPROCESSING FRAME CAPTURE (Crops and Increases Contrast)
  const captureLiveFrame = async () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const context = canvas.getContext("2d");

      const vWidth = video.videoWidth || 640;
      const vHeight = video.videoHeight || 480;

      // 1. Calculate the center crop bounding metrics matching our box guide template
      const cropWidth = vWidth * 0.55; 
      const cropHeight = vHeight * 0.75;
      const cropX = (vWidth - cropWidth) / 2;
      const cropY = (vHeight - cropHeight) / 2;

      canvas.width = cropWidth;
      canvas.height = cropHeight;

      // 2. Transfer only the targeted card inner-frame bounding segment to canvas context
      context.drawImage(video, cropX, cropY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);

      // 3. Digital Preprocessing Filter Pass: Convert to High-Contrast Grayscale
      try {
        const imgData = context.getImageData(0, 0, cropWidth, cropHeight);
        const data = imgData.data;
        
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          
          // Luma Grayscale transform formula
          let gray = 0.2126 * r + 0.7152 * g + 0.0722 * b;
          
          // Amplify edge contrast variance (boost distances from mid-tone gray)
          gray = 128 + 1.6 * (gray - 128);
          gray = Math.max(0, Math.min(255, gray)); // Keep within absolute byte limits (0-255)
          
          data[i] = gray;     // Red channel
          data[i + 1] = gray; // Green channel
          data[i + 2] = gray; // Blue channel
        }
        context.putImageData(imgData, 0, 0);
      } catch (filterError) {
        console.warn("Pixel matrix filtering skipped on this device sandbox context:", filterError);
      }

      // Convert the optimized black and white cropped preview to data asset string
      const filteredImageDataUrl = canvas.toDataURL("image/png");
      setCapturedImage(filteredImageDataUrl);
      stopLiveCamera();
      
      // Feed the crispy optimized image to Tesseract
      await processImageText(filteredImageDataUrl);
    }
  };

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
      setError("Please verify or enter a card name to pull value totals.");
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
        setError(`No unique database match discovered for "${searchName}". Try adjusting the spelling manually below.`);
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
          <p className="text-slate-400 text-sm mt-1">AI Preprocessing Template Scanner & Value Tracker</p>
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

            {/* Viewfinder Window Frame */}
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

              {scanStatus && (
                <div className="absolute inset-0 bg-slate-950/80 z-20 flex flex-col items-center justify-center p-4 text-center">
                  <Loader2 className="w-8 h-8 text-amber-400 animate-spin mb-2" />
                  <p className="text-sm font-semibold text-amber-400">{scanStatus}</p>
                </div>
              )}

              <video 
                ref={videoRef} 
                autoPlay 
                playsInline 
                muted
                className={`w-full h-full object-cover ${cameraActive ? "block" : "hidden"}`} 
              />

              {/* Template Card Guides Layer Overlay */}
              {cameraActive && (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/30 pointer-events-none">
                  <div className="w-44 aspect-[2.5/3.5] border-4 border-dashed border-amber-400 rounded-xl flex flex-col items-center justify-center bg-transparent shadow-[0_0_0_9999px_rgba(0,0,0,0.5)]">
                    <span className="text-[10px] text-amber-400 font-bold tracking-widest bg-slate-900/90 px-2 py-0.5 rounded shadow">ALIGN CARD</span>
                  </div>
                </div>
              )}

              {/* Enhanced Visual Crop Analyzer Screen */}
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

              {!cameraActive && !capturedImage && (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-500 p-6 text-center">
                  <p className="text-sm font-semibold">Inline Scanner Inactive</p>
                  <p className="text-xs mt-1 text-slate-600">Tap 'Start Inline Scanner' to initialize stream and capture high-contrast card metrics.</p>
                </div>
              )}
            </div>

            {/* Operational Controls */}
            <div className="flex flex-col gap-2 mb-6">
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

              {cameraActive && (
                <button
                  type="button"
                  onClick={captureLiveFrame}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 px-4 rounded-xl text-xs mt-1 transition-colors shadow-md uppercase tracking-wider"
                >
                  Snap Photo Inside Border
                </button>
              )}

              {!cameraActive && (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full bg-slate-800 border border-slate-700 hover:bg-slate-700 text-slate-300 font-medium py-2 px-4 rounded-xl text-xs mt-2 flex items-center justify-center gap-2"
                >
                  <Smartphone size={14} />
                  Backup: Launch Phone Camera App (No Border)
                </button>
              )}
            </div>

            {/* Review Form Fields Mapping Context */}
            <form onSubmit={handleSearchAndAdd} className="space-y-4 pt-4 border-t border-slate-700">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                  Card Name (Auto-Detected)
                </label>
                <input
                  type="text"
                  placeholder="Awaiting clean text scan..."
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
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Raw Filtered Text Stream Output:</p>
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

        {/* Portfolio rendering columns */}
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