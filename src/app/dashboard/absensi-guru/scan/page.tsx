"use client";
import React, { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { Camera, MapPin, User, AlertCircle, ArrowLeft, Loader2, CheckCircle, Timer, LogIn, LogOut, X, FileText, Calendar, UserX, RefreshCw } from "lucide-react";
import Link from "next/link";
import { toast } from "react-hot-toast";
import { motion } from "framer-motion";
import { initCameraForWebview } from "@/utils/webview-camera-helper";
interface LocationCache {
 position: { lat: number; lng: number };
 timestamp: number;
 accuracy: number;
}
export default function TeacherAttendanceScan() {
 const { user, userRole, schoolId } = useAuth();
 const router = useRouter();
 const videoRef = useRef<HTMLVideoElement | null>(null);
 const canvasRef = useRef<HTMLCanvasElement | null>(null);
 const streamRef = useRef<MediaStream | null>(null);
 const watchIdRef = useRef<number | null>(null);
 const locationCacheRef = useRef<LocationCache | null>(null);
 const [loading, setLoading] = useState(true);
 const [scanning, setScanning] = useState(false);
 const [capturing, setCapturing] = useState(false);
 const [processingCapture, setProcessingCapture] = useState(false);
 const [capturedImage, setCapturedImage] = useState<string | null>(null);
 const [photoTaken, setPhotoTaken] = useState(false);
 const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
 const [locationMessage, setLocationMessage] = useState("");
 const [locationAccuracy, setLocationAccuracy] = useState<number | null>(null);
 const [isGettingLocation, setIsGettingLocation] = useState(false);
 const [attendanceType, setAttendanceType] = useState<"in" | "out" | "izin" | "alpha">("in");
 const [izinReason, setIzinReason] = useState("");
 const [alphaReason, setAlphaReason] = useState("");
 const [recognizedTeacher, setRecognizedTeacher] = useState<any>(null);
 const [success, setSuccess] = useState(false);
 const [cameraError, setCameraError] = useState<string | null>(null);
 const [settings, setSettings] = useState({
   radius: 100,
   schoolLocation: { lat: 0, lng: 0 }
 });
 // Function to format date to DD-MM-YYYY
 const formatDateToIndonesian = (date: Date): string => {
   const day = date.getDate().toString().padStart(2, '0');
   const month = (date.getMonth() + 1).toString().padStart(2, '0');
   const year = date.getFullYear();
   return `${day}-${month}-${year}`;
 };
 // Enhanced location detection with multiple strategies
 const getDeviceLocationOptimized = async (): Promise<void> => {
   if (!navigator.geolocation) {
     setLocationMessage("Geolocation tidak didukung oleh browser ini");
     return;
   }
   setIsGettingLocation(true);
   setLocationMessage("Mendeteksi lokasi anda saat ini . . .");
   // Check if we have recent cached location (within 30 seconds)
   const now = Date.now();
   if (locationCacheRef.current &&
       (now - locationCacheRef.current.timestamp) < 30000) {
     const cached = locationCacheRef.current;
     setLocation(cached.position);
     setLocationAccuracy(cached.accuracy);
     validateLocationDistance(cached.position, cached.accuracy);
     setIsGettingLocation(false);
     return;
   }
   try {
     // Strategy 1: Fast location first (for immediate feedback)
     const fastLocation = await getFastLocation();
     if (fastLocation) {
       setLocation(fastLocation.position);
       setLocationAccuracy(fastLocation.accuracy);
       setLocationMessage(`Lokasi terdeteksi (akurasi: ${Math.round(fastLocation.accuracy)}m) - Mencari posisi lebih akurat...`);
       validateLocationDistance(fastLocation.position, fastLocation.accuracy);
     }
     // Strategy 2: High accuracy location (parallel)
     const accurateLocation = await getHighAccuracyLocation();
     if (accurateLocation) {
       setLocation(accurateLocation.position);
       setLocationAccuracy(accurateLocation.accuracy);
       validateLocationDistance(accurateLocation.position, accurateLocation.accuracy);

       // Cache the result
       locationCacheRef.current = {
         position: accurateLocation.position,
         timestamp: now,
         accuracy: accurateLocation.accuracy
       };
     }
     // Strategy 3: Start continuous tracking for real-time updates
     startLocationWatching();
   } catch (error) {
     console.error("Enhanced location error:", error);
     handleLocationError(error);
   } finally {
     setIsGettingLocation(false);
   }
 };
 // Fast location strategy (lower accuracy, faster response)
 const getFastLocation = (): Promise<{ position: { lat: number; lng: number }; accuracy: number } | null> => {
   return new Promise((resolve) => {
     const timeout = setTimeout(() => resolve(null), 3000); // 3 second timeout
     navigator.geolocation.getCurrentPosition(
       (position) => {
         clearTimeout(timeout);
         resolve({
           position: {
             lat: position.coords.latitude,
             lng: position.coords.longitude,
           },
           accuracy: position.coords.accuracy
         });
       },
       () => {
         clearTimeout(timeout);
         resolve(null);
       },
       {
         enableHighAccuracy: false, // Faster but less accurate
         timeout: 3000,
         maximumAge: 60000, // Accept 1-minute old position
       }
     );
   });
 };
 // High accuracy location strategy
 const getHighAccuracyLocation = (): Promise<{ position: { lat: number; lng: number }; accuracy: number } | null> => {
   return new Promise((resolve) => {
     let attempts = 0;
     const maxAttempts = 3;
     const tryGetLocation = () => {
       attempts++;
       const timeout = setTimeout(() => {
         if (attempts < maxAttempts) {
           tryGetLocation();
         } else {
           resolve(null);
         }
       }, 8000);
       navigator.geolocation.getCurrentPosition(
         (position) => {
           clearTimeout(timeout);
           resolve({
             position: {
               lat: position.coords.latitude,
               lng: position.coords.longitude,
             },
             accuracy: position.coords.accuracy
           });
         },
         (error) => {
           clearTimeout(timeout);
           console.warn(`Location attempt ${attempts} failed:`, error);
           if (attempts < maxAttempts) {
             setTimeout(tryGetLocation, 1000); // Retry after 1 second
           } else {
             resolve(null);
           }
         },
         {
           enableHighAccuracy: true,
           timeout: 8000,
           maximumAge: 10000, // Accept 10-second old position
         }
       );
     };
     tryGetLocation();
   });
 };
 // Start continuous location watching
 const startLocationWatching = () => {
   if (watchIdRef.current) {
     navigator.geolocation.clearWatch(watchIdRef.current);
   }
   watchIdRef.current = navigator.geolocation.watchPosition(
     (position) => {
       const newLocation = {
         lat: position.coords.latitude,
         lng: position.coords.longitude,
       };

       // Only update if accuracy is better or significantly different position
       if (!location ||
           position.coords.accuracy < (locationAccuracy || Infinity) ||
           calculateDistance(location.lat, location.lng, newLocation.lat, newLocation.lng) > 5) {

         setLocation(newLocation);
         setLocationAccuracy(position.coords.accuracy);
         validateLocationDistance(newLocation, position.coords.accuracy);

         // Update cache
         locationCacheRef.current = {
           position: newLocation,
           timestamp: Date.now(),
           accuracy: position.coords.accuracy
         };
       }
     },
     (error) => {
       console.warn("Watch position error:", error);
     },
     {
       enableHighAccuracy: true,
       timeout: 10000,
       maximumAge: 5000,
     }
   );
 };
 // Validate location distance with enhanced messaging
 const validateLocationDistance = (userLocation: { lat: number; lng: number }, accuracy: number) => {
   if (settings.schoolLocation.lat && settings.schoolLocation.lng) {
     const distance = calculateDistance(
       userLocation.lat, userLocation.lng,
       settings.schoolLocation.lat, settings.schoolLocation.lng
     );
     // Consider GPS accuracy in distance calculation
     const effectiveDistance = Math.max(0, distance - accuracy);

     if (effectiveDistance <= settings.radius) {
       setLocationMessage(`✅ Lokasi anda sekarang terdeteksi berada di Area Sekolah dengan jarak radius akurasi : ±${Math.round(distance)} meter.`);
     } else {
       const excess = effectiveDistance - settings.radius;
       if (excess <= accuracy) {
         setLocationMessage(`⚠️ Lokasi anda saat ini mendekati Area Sekolah dengan jarak radius akurasi : ±${Math.round(distance)} meter.`);
       } else {
         setLocationMessage(`❌ Lokasi anda saat ini berada pada Luar Area Sekolah dengan radius akurasi : ±${Math.round(distance)} meter.`);
       }
     }
   } else {
     setLocationMessage(`📍 Posisi anda sudah terdeteksi (Akurasi : ±${Math.round(accuracy)} meter), akan tapi Lokasi sekolah belum diatur.`);
   }
 };
 // Enhanced error handling
 const handleLocationError = (error: any) => {
   let errorMsg = "Gagal mendapatkan lokasi . . . ";

   if (error?.code) {
     switch (error.code) {
       case error.PERMISSION_DENIED:
         errorMsg += "Izin lokasi ditolak. Harap aktifkan izin lokasi di pengaturan browser.";
         break;
       case error.POSITION_UNAVAILABLE:
         errorMsg += "Informasi lokasi tidak tersedia. Pastikan GPS aktif dan sinyal bagus.";
         break;
       case error.TIMEOUT:
         errorMsg += "Waktu pencarian lokasi habis. Coba lagi atau pindah ke area dengan sinyal GPS lebih baik.";
         break;
       default:
         errorMsg += "Error tidak diketahui. Pastikan GPS diaktifkan dan browser memiliki izin lokasi.";
     }
   } else {
     errorMsg += "Pastikan GPS diaktifkan dan browser memiliki izin lokasi.";
   }

   setLocationMessage(errorMsg);
   toast.error(errorMsg);
 };
 // Manual location refresh
 const refreshLocation = async () => {
   // Clear cache to force fresh location
   locationCacheRef.current = null;
   setLocation(null);
   setLocationAccuracy(null);
   await getDeviceLocationOptimized();
 };
 // Handle page initialization and cleanup
 useEffect(() => {
   // Check authorization
   if (userRole !== 'admin' && userRole !== 'teacher' && userRole !== 'staff') {
     toast.error("Anda tidak memiliki akses ke halaman ini");
     router.push('/dashboard');
     return;
   }
   // Load settings
   const loadSettings = async () => {
     if (!schoolId) return;
     try {
       const { doc, getDoc } = await import('firebase/firestore');
       const { db } = await import('@/lib/firebase');
       const settingsDoc = await getDoc(doc(db, "settings", "location"));
       if (settingsDoc.exists()) {
         const data = settingsDoc.data();
         setSettings({
           radius: data.radius || 100,
           schoolLocation: {
             lat: data.latitude || 0,
             lng: data.longitude || 0
           }
         });
       }
     } catch (error) {
       console.error("Error loading settings:", error);
     }
   };
   loadSettings();
   setLoading(false);
   // Clean up function to stop camera and location watching
   return () => {
     if (streamRef.current) {
       const tracks = streamRef.current.getTracks();
       tracks.forEach(track => track.stop());
     }
     if (watchIdRef.current) {
       navigator.geolocation.clearWatch(watchIdRef.current);
     }
   };
 }, [router, schoolId, userRole]);
 // Get platform/environment information
 const getPlatformInfo = () => {
   const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : '';
   const isAndroid = /Android/i.test(userAgent);
   const isIOS = /iPhone|iPad|iPod/i.test(userAgent);
   const isMobile = isAndroid || isIOS;
   // Check if running in WebView
   const isWebView = () => {
     if (typeof window === 'undefined') return false;
     const standalone = window.navigator.standalone;
     const userAgent = window.navigator.userAgent.toLowerCase();
     const isAndroidWebView = /wv/.test(userAgent) || /Android.*Version\/[0-9]/.test(userAgent);
     const isIOSWebView = /iphone|ipod|ipad/.test(userAgent) && !window.navigator.standalone ||
                         typeof standalone === 'boolean' && standalone === false;
     const hasWebViewBridge = typeof window.ReactNativeWebView !== 'undefined' ||
                             typeof window.webkit?.messageHandlers !== 'undefined';
     return isAndroidWebView || isIOSWebView || hasWebViewBridge;
   };
   return { isAndroid, isIOS, isMobile, isWebView: isWebView(), userAgent };
 };
 // Start camera for scanning with enhanced webview support
 const startCamera = async () => {
   try {
     setScanning(true);
     setCameraError(null);
     // Get platform info to adapt camera access strategy
     const platform = getPlatformInfo();
     console.log("Platform detected:", platform);
     // Different camera initialization approach based on environment
     let stream: MediaStream | null = null;
     if (platform.isWebView) {
       console.log("Using WebView camera initialization");
       stream = await initCameraForWebview({
         width: 640,
         height: 480,
         facing: "user",
         onError: (err) => {
           console.error("WebView camera error :", err);
           setCameraError(`WebView camera error : ${err.message || err}`);
         }
       });
     } else {
       console.log("Using standard camera initialization");
       try {
         stream = await navigator.mediaDevices.getUserMedia({
           video: {
             width: { ideal: 640 },
             height: { ideal: 480 },
             facingMode: "user"
           }
         });
       } catch (mobileError) {
         console.warn("Failed with mobile settings, trying fallback:", mobileError);
         stream = await navigator.mediaDevices.getUserMedia({ video: true });
       }
     }
     if (!stream) {
       throw new Error("Failed to initialize camera stream");
     }
     // Store stream in ref for later cleanup
     streamRef.current = stream;
     // Connect stream to video element with delayed check for element existence
     const connectStreamToVideo = () => {
       if (videoRef.current) {
         videoRef.current.srcObject = stream;
         videoRef.current.onloadedmetadata = () => {
           if (videoRef.current) {
             videoRef.current.play().catch(playError => {
               console.error("Error playing video :", playError);
               setCameraError(`Error playing video : ${playError.message}`);
             });
           }
         };
       } else {
         setTimeout(connectStreamToVideo, 100);
       }
     };
     connectStreamToVideo();
     // Get location with enhanced detection
     await getDeviceLocationOptimized();
   } catch (error: any) {
     console.error("Error starting camera :", error);
     let errorMessage = "Gagal mengakses kamera";
     if (error.name === "NotFoundError" || error.name === "DevicesNotFoundError") {
       errorMessage = "Tidak menemukan kamera pada perangkat";
     } else if (error.name === "NotAllowedError" || error.name === "PermissionDeniedError") {
       errorMessage = "Izin kamera ditolak. Harap berikan izin kamera di pengaturan perangkat Anda";
     } else if (error.name === "NotReadableError" || error.name === "TrackStartError") {
       errorMessage = "Kamera sedang digunakan oleh aplikasi lain";
     } else if (error.name === "OverconstrainedError" || error.name === "ConstraintNotSatisfiedError") {
       errorMessage = "Tidak dapat menemukan kamera yang sesuai dengan persyaratan";
     } else {
       errorMessage = `Gagal mengakses kamera : ${error.message || error}`;
     }
     setCameraError(errorMessage);
     toast.error(errorMessage);
     setScanning(false);
   }
 };
 // Stop camera
 const stopCamera = () => {
   if (streamRef.current) {
     const tracks = streamRef.current.getTracks();
     tracks.forEach(track => track.stop());
     streamRef.current = null;
   }
   if (videoRef.current) {
     videoRef.current.srcObject = null;
   }
   if (watchIdRef.current) {
     navigator.geolocation.clearWatch(watchIdRef.current);
     watchIdRef.current = null;
   }
   setScanning(false);
   setPhotoTaken(false);
   setCameraError(null);
 };
 // Capture image
 const captureImage = async () => {
   if (!videoRef.current || !canvasRef.current) {
     toast.error("Perangkat kamera tidak siap");
     return;
   }
   try {
     setCapturing(true);
     // Draw video frame to canvas
     const video = videoRef.current;
     const canvas = canvasRef.current;
     const context = canvas.getContext('2d');
     if (!context) {
       throw new Error("Tidak dapat membuat konteks canvas");
     }
     // Set canvas dimensions to match video
     canvas.width = video.videoWidth || 640;
     canvas.height = video.videoHeight || 480;
     // Draw video frame to canvas - handle potential errors
     try {
       context.drawImage(video, 0, 0, canvas.width, canvas.height);
     } catch (drawError) {
       console.error("Error drawing to canvas:", drawError);
       toast.error("Gagal mengambil gambar dari video");
       setCapturing(false);
       return;
     }
     // Get image data as base64 - handle potential errors
     let imageData;
     try {
       imageData = canvas.toDataURL('image/jpeg', 0.8);
     } catch (imageError) {
       console.error("Error getting image data:", imageError);
       toast.error("Gagal mengkonversi gambar");
       setCapturing(false);
       return;
     }
     setCapturedImage(imageData);
     // Process the image (detect face and identify)
     await processImage(imageData);
   } catch (error) {
     console.error("Error capturing image:", error);
     toast.error("Gagal mengambil gambar");
     setCapturing(false);
   }
 };
 // Process the captured image
 const processImage = async (imageData: string) => {
   try {
     setProcessingCapture(true);
     setPhotoTaken(true);
     // Get teacher data from the current user or fetch from database
     const { db } = await import('@/lib/firebase');
     const { doc, getDoc } = await import('firebase/firestore');
     if (userRole === 'teacher' || userRole === 'staff') {
       // If the current user is a teacher or staff, use their data
       if (user && user.uid) {
         const userDoc = await getDoc(doc(db, "users", user.uid));
         if (userDoc.exists()) {
           const userData = userDoc.data();
           setRecognizedTeacher({
             id: user.uid,
             name: userData.name || user.displayName || "Nama tidak diketahui",
             nik: userData.nik || "NIP tidak tersedia",
             role: userData.role === 'teacher' ? 'Guru' : 'Tenaga Kependidikan'
           });
         } else {
           toast.error("Data Pengguna tidak ditemukan . . .");
         }
       }
     } else if (userRole === 'admin') {
       // If the user is an admin, use their data for simplicity
       if (user && user.uid) {
         const userDoc = await getDoc(doc(db, "users", user.uid));
         if (userDoc.exists()) {
           const userData = userDoc.data();
           setRecognizedTeacher({
             id: user.uid,
             name: userData.name || user.displayName || "Administrator",
             nik: userData.nik || "NIP tidak tersedia . . .",
             role: "Administrator"
           });
         }
       }
     }
     setProcessingCapture(false);
     setCapturing(false);
   } catch (error) {
     console.error("Error processing image :", error);
     toast.error("Gagal memproses gambar");
     setProcessingCapture(false);
     setCapturing(false);
   }
 };
 // Submit attendance with enhanced location validation
 const submitAttendance = async () => {
   if (!schoolId || !recognizedTeacher) {
     toast.error("Data tidak lengkap . . .");
     return;
   }
   try {
     setProcessingCapture(true);
     const currentDate = new Date();
     const dateStr = currentDate.toISOString().split('T')[0]; // YYYY-MM-DD for database
     const displayDateStr = formatDateToIndonesian(currentDate); // DD-MM-YYYY for display
     const timeStr = currentDate.toLocaleTimeString('id-ID', {
       hour: '2-digit',
       minute: '2-digit',
       second: '2-digit',
       hour12: false
     });
     // Enhanced location validation (not required for 'izin' or 'alpha' type)
     if (attendanceType !== 'izin' && attendanceType !== 'alpha') {
       if (!location || !settings.schoolLocation) {
         toast.error("Data lokasi tidak lengkap . . .");
         setProcessingCapture(false);
         return;
       }
       const distance = calculateDistance(
         location.lat, location.lng,
         settings.schoolLocation.lat, settings.schoolLocation.lng
       );
       // Consider GPS accuracy in validation
       const effectiveDistance = Math.max(0, distance - (locationAccuracy || 0));

       if (effectiveDistance > settings.radius) {
         const excess = effectiveDistance - settings.radius;
         if (excess > (locationAccuracy || 0)) {
           toast.error(`Anda berada di Luar area Absensi Sekolah, dengan jarak sekitar : ±${Math.round(distance)} meter, dengan ketepatan akurasi : ±${Math.round(locationAccuracy || 0)} meter.`);
           setProcessingCapture(false);
           return;
         } else {
           // Show warning but allow (within GPS accuracy margin)
           toast.warning(`Lokasi mungkin di luar area sekolah, tetapi masih dalam margin akurasi GPS.`);
         }
       }
     }
     // Validate reason for izin and alpha
     if (attendanceType === 'izin' && !izinReason.trim()) {
       toast.error("Alasan izin harus diisi . . .");
       setProcessingCapture(false);
       return;
     }
     if (attendanceType === 'alpha' && !alphaReason.trim()) {
       toast.error("Alasan alpha harus diisi . . .");
       setProcessingCapture(false);
       return;
     }
     // Check if already submitted for today
     const { collection, query, where, getDocs, addDoc, serverTimestamp } = await import('firebase/firestore');
     const { db } = await import('@/lib/firebase');
     const attendanceRef = collection(db, "teacherAttendance");
     const existingAttendanceQuery = query(
       attendanceRef,
       where("teacherId", "==", recognizedTeacher.id),
       where("date", "==", dateStr),
       where("type", "==", attendanceType)
     );
     const existingSnapshot = await getDocs(existingAttendanceQuery);
     if (!existingSnapshot.empty) {
       const typeText = attendanceType === 'in' ? 'Masuk' :
                       attendanceType === 'out' ? 'Pulang' :
                       attendanceType === 'izin' ? 'Izin' : 'Alpha';
       toast.error(`Anda sudah melakukan absensi ${typeText} hari ini`);
       setProcessingCapture(false);
       return;
     }
     // Determine status based on attendance type and time
     let status = "present"; // Default status
     if (attendanceType === 'izin') {
       status = "izin";
     } else if (attendanceType === 'alpha') {
       status = "alpha";
     } else {
       // For 'in' and 'out' types, check if late
       const hour = currentDate.getHours();
       if (attendanceType === 'in' && hour >= 8) {
         status = "terlambat";
       }
     }
     // Save attendance record with location accuracy
     const attendanceData = {
       teacherId: recognizedTeacher.id,
       teacherName: recognizedTeacher.name,
       teacherNik: recognizedTeacher.nik,
       date: dateStr,
       time: timeStr,
       timestamp: serverTimestamp(),
       type: attendanceType,
       status: status,
       location: {
         lat: location?.lat || 0,
         lng: location?.lng || 0,
         accuracy: locationAccuracy || 0
       },
       schoolId: schoolId,
       note: attendanceType === 'izin' ? izinReason :
             attendanceType === 'alpha' ? alphaReason : ""
     };
     await addDoc(attendanceRef, attendanceData);
     // Send Telegram notification
     await sendTelegramNotification(
       recognizedTeacher.name,
       attendanceType,
       displayDateStr,
       timeStr,
       attendanceType === 'izin' ? izinReason : attendanceType === 'alpha' ? alphaReason : ""
     );
     setSuccess(true);
     toast.success(`Absensi ${
       attendanceType === 'in' ? 'masuk' :
       attendanceType === 'out' ? 'pulang' :
       attendanceType === 'izin' ? 'izin' :
       'alpha'
     } berhasil tercatat!`);
   } catch (error) {
     console.error("Error submitting attendance:", error);
     toast.error("Gagal mencatat absensi");
   } finally {
     setProcessingCapture(false);
   }
 };
 // Reset the process
 const resetProcess = () => {
   setCapturedImage(null);
   setPhotoTaken(false);
   setRecognizedTeacher(null);
   setSuccess(false);
   setIzinReason("");
   setAlphaReason("");
   stopCamera();
 };
 // Calculate distance between two points using Haversine formula
 const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
   const R = 6371e3; // Earth radius in meters
   const φ1 = lat1 * Math.PI / 180;
   const φ2 = lat2 * Math.PI / 180;
   const Δφ = (lat2 - lat1) * Math.PI / 180;
   const Δλ = (lon2 - lon1) * Math.PI / 180;
   const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
   const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
   return R * c; // Distance in meters
 };
 // Send Telegram notification
 const sendTelegramNotification = async (
   teacherName: string,
   attendanceType: string,
   date: string,
   time: string,
   reason: string = ""
 ) => {
   try {
     const { doc, getDoc } = await import('firebase/firestore');
     const { db } = await import('@/lib/firebase');
     // Get Telegram settings
     const telegramSettingsDoc = await getDoc(doc(db, "settings", "telegram"));
     if (!telegramSettingsDoc.exists()) {
       console.error("Telegram settings not found");
       return;
     }
     const telegramSettings = telegramSettingsDoc.data();
     const token = telegramSettings.token || "7702797779:AAELhARB3HkvB9hh5e5D64DCC4faDfcW9IM";
     const chatId = telegramSettings.chatId || "";
     if (!chatId) {
       console.error("No chat ID found for notification");
       return;
     }
     // Format message based on attendance type
     let messageType = "";
     if (attendanceType === 'in') messageType = 'MASUK';
     else if (attendanceType === 'out') messageType = 'PULANG';
     else if (attendanceType === 'izin') messageType = 'IZIN';
     else if (attendanceType === 'alpha') messageType = 'ALPHA';
     let message = `GTK dengan nama ${teacherName} telah melakukan Absensi "${messageType}" pada hari ini, tanggal ${date} pukul ${time} WIB.`;

     // Add location accuracy info for location-based attendance
     if (attendanceType !== 'izin' && attendanceType !== 'alpha' && locationAccuracy) {
       message += `\n📍 Akurasi Lokasi : ±${Math.round(locationAccuracy)} meter.`;
     }
     // Add reason if it's an izin or alpha type
     if ((attendanceType === 'izin' || attendanceType === 'alpha') && reason) {
       message += `\nAlasan ${messageType} : "${reason}".`;
     }
     // Send notification
     await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
       method: 'POST',
       headers: {
         'Content-Type': 'application/json',
       },
       body: JSON.stringify({
         chat_id: chatId,
         text: message,
       }),
     });
   } catch (error) {
     console.error("Error sending Telegram notification:", error);
   }
 };
 return (
   <div className="max-w-3xl mx-auto pb-20 md:pb-6 px-1 sm:px-4 md:px-6">
     <div className="flex items-center justify-between mb-6">
       <div className="flex items-center">
         <Link href="/dashboard/absensi-guru" className="p-2 mr-2 hover:bg-gray-100 rounded-full">
           <ArrowLeft size={20} />
         </Link>
         <h1 className="text-2xl font-bold text-gray-800">
           <span className="editable-text">Absensi Guru & Tendik</span>
         </h1>
       </div>
     </div>
     {loading ? (
       <div className="flex justify-center items-center h-64">
         <Loader2 className="h-12 w-12 text-primary animate-spin" />
       </div>
     ) : success ? (
       <motion.div
         className="bg-white rounded-xl shadow-md p-8 text-center"
         initial={{ opacity: 0, scale: 0.9 }}
         animate={{ opacity: 1, scale: 1 }}
         transition={{ duration: 0.3 }}
       >
         <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
           <CheckCircle className="h-12 w-12 text-green-600" />
         </div>
         <h2 className="text-2xl font-bold text-gray-800 mb-2">
           <span className="editable-text">Absensi Berhasil!</span>
         </h2>
         <p className="text-gray-600 mb-6">
           GTK dengan nama {recognizedTeacher?.name}
           <span className="editable-text"> telah berhasil melakukan Absensi </span>"{
           attendanceType === 'in' ? 'MASUK' :
           attendanceType === 'out' ? 'PULANG' :
           attendanceType === 'izin' ? 'IZIN' :
           'ALPHA'
         }" pada hari ini,
           {(attendanceType === 'izin' && izinReason) ? ` dengan alasan : "${izinReason}"` : ''}
           {(attendanceType === 'alpha' && alphaReason) ? ` dengan alasan : "${alphaReason}"` : ''}.
         </p>
         <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
           <button
             onClick={resetProcess}
             className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
           >
             <span className="editable-text">Absen Lagi</span>
           </button>
           <Link
             href="https://t.me/AbsenModernBot"
             target="_blank"
             className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center"
           >
             <span className="editable-text">Lihat Hasil Absensi</span>
           </Link>
           <Link
             href="/dashboard"
             className="px-6 py-3 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors flex items-center justify-center"
           >
             <span className="editable-text">Kembali</span>
           </Link>
         </div>
       </motion.div>
     ) : (
       <div className="bg-white rounded-xl shadow-md overflow-hidden">
         <div className="p-4 border-b border-gray-200">
           <center>
             <h2 className="text text-gray-700 font-semibold mb-4">
               <span className="editable-text">PILIH JENIS ABSENSI</span>
             </h2>
           </center>
           {/* Attendance type selector */}
           <div className="flex items-center justify-center p-3 bg-gray-100 rounded-lg mb-4">
             <div className="flex space-x-1 bg-white p-1 rounded-lg shadow-sm">
               <button
                 onClick={() => setAttendanceType("in")}
                 className={`flex items-center gap-2 px-4 py-2 rounded-md transition-colors ${
                   attendanceType === "in" ? "bg-green-600 text-white" : "bg-white text-gray-700"
                 }`}
               >
                 <span><span className="editable-text">Masuk</span></span>
               </button>
               <button
                 onClick={() => setAttendanceType("izin")}
                 className={`flex items-center gap-2 px-4 py-2 rounded-md transition-colors ${
                   attendanceType === "izin" ? "bg-green-600 text-white" : "bg-white text-gray-700"
                 }`}
               >
                 <span><span className="editable-text">Izin</span></span>
               </button>
               <button
                 onClick={() => setAttendanceType("alpha")}
                 className={`flex items-center gap-2 px-4 py-2 rounded-md transition-colors ${
                   attendanceType === "alpha" ? "bg-green-600 text-white" : "bg-white text-gray-700"
                 }`}
               >
                 <span><span className="editable-text">Alpha</span></span>
               </button>

               <button
                 onClick={() => setAttendanceType("out")}
                 className={`flex items-center gap-2 px-3 py-2 rounded-md transition-colors ${
                   attendanceType === "out" ? "bg-green-600 text-white" : "bg-white text-gray-700"
                 }`}
               >
                 <span><span className="editable-text">Pulang</span></span>
               </button>
             </div>
           </div>
           {/* If Izin is selected, show reason input */}
           {attendanceType === "izin" && (
             <div className="mb-4">
               <label htmlFor="izinReason" className="block text-sm font-medium text-gray-700 mb-1">
                 <span className="editable-text">ALASAN IZIN :</span>
               </label>
               <textarea
                 id="izinReason"
                 value={izinReason}
                 onChange={(e) => setIzinReason(e.target.value)}
                 className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-primary focus:border-primary"
                 placeholder="Masukkan alasan izin. Contoh : rapat, dinas luar, dll."
                 rows={3}
                 required={attendanceType === 'izin'}
               />
             </div>
           )}
           {/* If Alpha is selected, show reason input */}
           {attendanceType === "alpha" && (
             <div className="mb-4">
               <label htmlFor="alphaReason" className="block text-sm font-medium text-gray-700 mb-1">
                 <span className="editable-text">ALASAN ALPHA :</span>
               </label>
               <textarea
                 id="alphaReason"
                 value={alphaReason}
                 onChange={(e) => setAlphaReason(e.target.value)}
                 className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-primary focus:border-primary"
                 placeholder="Masukkan alasan Alpha. Contoh : tidak masuk tanpa keterangan, dll."
                 rows={3}
                 required={attendanceType === 'alpha'}
               />
             </div>
           )}
           {/* Camera view */}
           <div className="relative w-full aspect-video bg-black rounded-lg overflow-hidden mb-4">
             {scanning ? (
               <>
                 <video ref={videoRef} className="w-full h-full object-cover" autoPlay playsInline muted></video>
                 {cameraError && (
                   <div className="absolute inset-0 bg-black bg-opacity-70 flex flex-col items-center justify-center text-white p-4">
                     <AlertCircle size={40} className="text-red-500 mb-2" />
                     <p className="text-center mb-2">{cameraError}</p>
                     <button
                       onClick={() => {
                         stopCamera();
                         setTimeout(startCamera, 1000);
                       }}
                       className="px-4 py-2 bg-blue-600 rounded-lg text-sm"
                     >
                       <span className="editable-text">Coba Lagi</span>
                     </button>
                   </div>
                 )}
                 {/* Photo capture guide overlay */}
                 {!cameraError && (
                   <div className="absolute inset-0 flex items-center justify-center">
                     <div className="absolute bottom-1 left-0 right-0 text-center">
                       <p className="text-gray-400 text-sm bg-black bg-opacity-20 inline-block px-3 py-1 rounded">
                         <span className="editable-text">Posisikan diri Anda dengan jelas</span>
                       </p>
                     </div>
                   </div>
                 )}
               </>
             ) : capturedImage ? (
               <img src={capturedImage} alt="Captured" className="w-full h-full object-cover" />
             ) : (
               <div className="flex flex-col items-center justify-center h-full">
                 <Camera size={48} className="text-gray-400 mb-4" />
                 <p className="text-gray-400"><span className="editable-text">Kamera Belum Diaktifkan</span></p>
               </div>
             )}
             {/* Hidden canvas for processing */}
             <canvas ref={canvasRef} className="hidden"></canvas>
           </div>
           {/* Enhanced Location information */}
           {attendanceType !== 'izin' && attendanceType !== 'alpha' && (
             <div className={`p-3 mb-3 rounded-lg flex items-center justify-between ${
               !location ? 'bg-gray-100 text-gray-500' :
               locationMessage.includes('❌') ? 'bg-red-100 text-red-700' :
               locationMessage.includes('⚠️') ? 'bg-amber-100 text-amber-700' :
               locationMessage.includes('✅') ? 'bg-green-100 text-green-700' :
               'bg-blue-100 text-blue-700'
             }`}>
               <div className="flex items-center flex-1">
                 <MapPin className="h-5 w-5 mr-2 flex-shrink-0" />
                 <p className="text-sm">
                   {isGettingLocation ? (
                     <span className="flex items-center text-blue-500">
                       <Loader2 className="h-4 w-4 animate-spin mr-2 text-blue-500" />
                       {locationMessage || "Mencari lokasi . . ."}
                     </span>
                   ) : (
                     locationMessage || "Lokasi Belum Terdeteksi . . ."
                   )}
                 </p>
               </div>

               {location && !isGettingLocation && (
                 <button
                   onClick={refreshLocation}
                   className="ml-2 p-1 hover:bg-white hover:bg-opacity-50 rounded transition-colors"
                   title="Refresh lokasi"
                 >
                   <RefreshCw className="h-4 w-4" />
                 </button>
               )}
             </div>
           )}
           {/* Special notice for Izin */}
           {attendanceType === 'izin' && (
             <div className="p-3 mb-3 rounded-lg flex items-center bg-amber-100 text-amber-700">
               <FileText className="h-5 w-5 mr-2" />
               <p className="text-sm">Anda akan melakukan absensi dengan status Izin. Harap isi alasan Izin dengan lengkap.</p>
             </div>
           )}
           {/* Special notice for Alpha */}
           {attendanceType === 'alpha' && (
             <div className="p-3 mb-3 rounded-lg flex items-center bg-red-100 text-red-700">
               <UserX className="h-5 w-5 mr-2" />
               <p className="text-sm">Anda akan melakukan absensi dengan status Alpha. Harap isi alasan Alpha dengan lengkap.</p>
             </div>
           )}
           {/* Recognized teacher */}
           {recognizedTeacher && (
             <center>
               <div className="p-4 bg-blue-600 rounded-lg mb-1 border border-purple-200">
                 <h3 className="text-lg font-semibold text-white">{recognizedTeacher.name}</h3>
                 <p className="text-sm text-white"><span className="editable-text"></span>{recognizedTeacher.nik}</p>
                 <p className="text-sm text-white"><span className="editable-text">Status : </span>{recognizedTeacher.role}</p>
               </div>
             </center>
           )}
         </div>
         <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
           {!scanning && !capturedImage && (
             <button
               onClick={startCamera}
               className="col-span-full py-3 bg-blue-800 text-white px-6 py-3 rounded-lg hover:bg-orange-500 active:bg-orange-700 transition-colors flex items-center justify-center gap-2"
             >
               <Camera size={20} />
               <span className="editable-text">Aktifkan Kamera</span>
             </button>
           )}
           {scanning && !capturing && (
             <button
               onClick={captureImage}
               className="col-span-full py-3 bg-blue-800 text-white px-6 py-3 rounded-lg hover:bg-orange-500 active:bg-orange-700 transition-colors flex items-center justify-center gap-2"
               disabled={capturing || !!cameraError}
             >
               <Camera size={20} />
               <span className="editable-text">Ambil Gambar</span>
             </button>
           )}
           {capturedImage && photoTaken && recognizedTeacher && !processingCapture && (
             <button
               onClick={submitAttendance}
               className="py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
               disabled={processingCapture ||
                        (attendanceType === 'izin' && !izinReason.trim()) ||
                        (attendanceType === 'alpha' && !alphaReason.trim())}
             >
               <CheckCircle size={20} />
               <span className="editable-text">Simpan Absensi</span>
             </button>
           )}
           {(scanning || capturedImage) && !processingCapture && (
             <button
               onClick={resetProcess}
               className="py-3 bg-gray-200 text-gray-800 rounded-lg font-medium hover:bg-gray-300 transition-colors flex items-center justify-center gap-2"
             >
               <X size={20} />
               <span className="editable-text">Batal</span>
             </button>
           )}
           {processingCapture && (
             <div className="col-span-full flex items-center justify-center py-3 bg-orange-300 text-white rounded-lg font-medium">
               <Loader2 size={20} className="animate-spin mr-2" />
               <span className="editable-text">Memproses...</span>
             </div>
           )}
         </div>
       </div>
     )}
     <hr className="border-t border-none mb-3" />
   </div>
 );
}
