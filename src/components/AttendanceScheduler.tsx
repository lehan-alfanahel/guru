"gunakan klien"; 
impor { useEffect, useRef } dari "bereaksi"; 
impor { useAuth } dari "@/context/AuthContext"; 
impor { checkAndMarkAlpha } dari "@/lib/pemeriksa-kehadiran"; 
ekspor default fungsi AttendanceScheduler() { 
const { schoolId } = useAuth(); 
const intervalRef = useRef<NodeJS.Timeout | null>(null); 

useEffect(() => { 
   jika (!schoolId) kembali; 

   // Jalankan segera sekali 
   checkAndMarkAlpha(schoolId); 

   // Kemudian atur interval untuk memeriksa setiap jam 
   intervalRef.current = setInterval(() => { 
     checkAndMarkAlpha(schoolId); 
   }, 60 * 60 * 1000); // Setiap jam 

   kembali () => { 
     jika (intervalRef.current) { 
       clearInterval(intervalRef.current); 
     } 
   }; 
}, [schoolId]); 

// Komponen ini tidak merender apa pun 
return null; 
} 
Untuk menggunakan AttendanceScheduler, kita dapat menambahkannya ke tata letak dasbor: 
// src/app/dashboard/layout.tsx - Tambahkan komponen ini import 
import AttendanceScheduler from "@/components/AttendanceScheduler"; 
// Di dalam komponen tata letak, tambahkan: 
{userRole === 'admin' && <AttendanceScheduler />}