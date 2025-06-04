"use client";
import React, { useState, useEffect } from "react";
import { ArrowLeft, Calendar, Download, FileSpreadsheet, FileText, Loader2, ChevronLeft, ChevronRight, AlertCircle } from "lucide-react";
import Link from "next/link";
import { format, subMonths, addMonths } from "date-fns";
import { id } from "date-fns/locale";
import { toast } from "react-hot-toast";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { doc, getDoc, collection, query, where, getDocs, orderBy } from "firebase/firestore";
import { generateTeacherReportPDF, generateTeacherReportExcel } from "@/lib/teacherReportGenerator";
import { motion } from "framer-motion";
export default function TeacherAttendanceReport() {
 const { schoolId, user } = useAuth();
 const [currentDate, setCurrentDate] = useState(new Date());
 const [isDownloading, setIsDownloading] = useState(false);
 const [loading, setLoading] = useState(true);
 const [teachers, setTeachers] = useState<any[]>([]);
 const [filteredTeachers, setFilteredTeachers] = useState<any[]>([]);
 const [userData, setUserData] = useState<any>(null);
 const [attendanceData, setAttendanceData] = useState<any[]>([]);
 const [error, setError] = useState<string | null>(null);
 const [teacherCount, setTeacherCount] = useState(0);
 const [schoolInfo, setSchoolInfo] = useState({
   name: "NAMA SEKOLAH",
   address: "Alamat",
   npsn: "NPSN",
   principalName: "",
   principalNip: ""
 });
 // Format current date for display
 const formattedMonth = format(currentDate, "MMMM yyyy", { locale: id });
 // Fetch school, teachers and attendance data
 useEffect(() => {
   const fetchData = async () => {
     if (!schoolId) return;
     try {
       setLoading(true);
       setError(null);
       // Fetch school info
       const schoolDoc = await getDoc(doc(db, "schools", schoolId));
       if (schoolDoc.exists()) {
         const data = schoolDoc.data();
         setSchoolInfo({
           name: data.name || "NAMA SEKOLAH",
           address: data.address || "Alamat",
           npsn: data.npsn || "NPSN",
           principalName: data.principalName || "",
           principalNip: data.principalNip || ""
         });
       }
       // Fetch user data for administrator signature
       if (user) {
         const userDoc = await getDoc(doc(db, "users", user.uid));
         if (userDoc.exists()) {
           setUserData(userDoc.data());
         }
       }
       // Count total teachers in the school
       const usersRef = collection(db, "users");
       const teachersQuery = query(
         usersRef,
         where("schoolId", "==", schoolId),
         where("role", "in", ["teacher", "staff"])
       );
       const teachersSnapshot = await getDocs(teachersQuery);
       setTeacherCount(teachersSnapshot.size);
       // Fetch teachers with attendance data
       await fetchAttendanceData();
     } catch (error) {
       console.error("Error fetching data:", error);
       setError("Gagal mengambil data dari database. Silakan coba lagi nanti.");
       toast.error("Gagal mengambil data dari database");
     } finally {
       setLoading(false);
     }
   };
   fetchData();
 }, [schoolId, user]);
 // Fetch attendance data when month changes
 useEffect(() => {
   if (schoolId) {
     fetchAttendanceData();
   }
 }, [currentDate, schoolId]);
 // Set all teachers to filtered teachers
 useEffect(() => {
   setFilteredTeachers(teachers);
 }, [teachers]);
 // Function to fetch attendance data
 const fetchAttendanceData = async () => {
   if (!schoolId) return;
   try {
     setLoading(true);
     setError(null);
     // Get start and end date for the month
     const year = currentDate.getFullYear();
     const month = currentDate.getMonth() + 1;
     const startDate = `${year}-${month.toString().padStart(2, '0')}-01`;
     // Calculate the last day of the month
     const lastDay = new Date(year, month, 0).getDate();
     const endDate = `${year}-${month.toString().padStart(2, '0')}-${lastDay}`;
     // Get all teachers
     const usersRef = collection(db, "users");
     const teachersQuery = query(
       usersRef,
       where("schoolId", "==", schoolId),
       where("role", "in", ["teacher", "staff"]),
       orderBy("name", "asc")
     );
     const teachersSnapshot = await getDocs(teachersQuery);
     if (teachersSnapshot.empty) {
       setTeachers([]);
       setFilteredTeachers([]);
       setAttendanceData([]);
       return;
     }
     const teachersList: any[] = [];
     teachersSnapshot.forEach(doc => {
       teachersList.push({
         id: doc.id,
         ...doc.data(),
         // Initialize attendance counters
         hadir: 0,
         terlambat: 0,
         izin: 0,
         alpha: 0,
         total: 0
       });
     });
     // If we have teachers, get their attendance for the selected month
     if (teachersList.length > 0) {
       const attendanceRef = collection(db, "teacherAttendance");
       const attendanceQuery = query(
         attendanceRef,
         where("schoolId", "==", schoolId),
         where("date", ">=", startDate),
         where("date", "<=", endDate)
       );
       const attendanceSnapshot = await getDocs(attendanceQuery);
       // Process attendance records
       attendanceSnapshot.forEach(doc => {
         const data = doc.data();
         const teacherId = data.teacherId;
         const status = data.status;
         const type = data.type; // 'in' or 'out'
         // Find the teacher and update their attendance counts
         const teacherIndex = teachersList.findIndex(t => t.id === teacherId);
         if (teacherIndex !== -1) {
           // Only count check-ins, not check-outs
           if (type === 'in') {
             if (status === 'present') {
               teachersList[teacherIndex].hadir++;
             } else if (status === 'late') {
               teachersList[teacherIndex].terlambat++;
             } else if (status === 'permitted') {
               teachersList[teacherIndex].izin++;
             } else if (status === 'absent') {
               teachersList[teacherIndex].alpha++;
             }
             teachersList[teacherIndex].total++;
           }
         }
       });
     }
     // Sort teachers by name
     teachersList.sort((a, b) => a.name.localeCompare(b.name));
     setTeachers(teachersList);
     setFilteredTeachers(teachersList);
     // Calculate overall percentages
     let totalHadir = 0;
     let totalTerlambat = 0;
     let totalIzin = 0;
     let totalAlpha = 0;
     let totalAttendance = 0;
     teachersList.forEach(teacher => {
       totalHadir += teacher.hadir || 0;
       totalTerlambat += teacher.terlambat || 0;
       totalIzin += teacher.izin || 0;
       totalAlpha += teacher.alpha || 0;
       totalAttendance += teacher.total || 0;
     });
     // Prevent division by zero
     if (totalAttendance === 0) totalAttendance = 1;
     // Calculate percentages with one decimal place
     const hadirPercentage = (totalHadir / totalAttendance * 100).toFixed(1);
     const terlambatPercentage = (totalTerlambat / totalAttendance * 100).toFixed(1);
     const izinPercentage = (totalIzin / totalAttendance * 100).toFixed(1);
     const alphaPercentage = (totalAlpha / totalAttendance * 100).toFixed(1);
     setAttendanceData([
       {
         type: 'Hadir',
         value: hadirPercentage,
         color: 'bg-blue-100 text-blue-800',
         count: totalHadir
       },
       {
         type: 'Terlambat',
         value: terlambatPercentage,
         color: 'bg-amber-100 text-amber-800',
         count: totalTerlambat
       },
       {
         type: 'Izin',
         value: izinPercentage,
         color: 'bg-green-100 text-green-800',
         count: totalIzin
       },
       {
         type: 'Alpha',
         value: alphaPercentage,
         color: 'bg-red-100 text-red-800',
         count: totalAlpha
       }
     ]);
   } catch (error) {
     console.error("Error fetching attendance data:", error);
     setError("Gagal mengambil data kehadiran. Silakan coba lagi nanti.");
     toast.error("Gagal mengambil data kehadiran");
     // Set default values on error
     setAttendanceData([
       {
         type: 'Hadir',
         value: "0.0",
         color: 'bg-blue-100 text-blue-800',
         count: 0
       },
       {
         type: 'Terlambat',
         value: "0.0",
         color: 'bg-amber-100 text-amber-800',
         count: 0
       },
       {
         type: 'Izin',
         value: "0.0",
         color: 'bg-green-100 text-green-800',
         count: 0
       },
       {
         type: 'Alpha',
         value: "0.0",
         color: 'bg-red-100 text-red-800',
         count: 0
       }
     ]);
   } finally {
     setLoading(false);
   }
 };
 const handlePrevMonth = () => {
   setCurrentDate(subMonths(currentDate, 1));
 };
 const handleNextMonth = () => {
   setCurrentDate(addMonths(currentDate, 1));
 };
 const handleDownloadPDF = async () => {
   setIsDownloading(true);
   try {
     await generateTeacherReportPDF({
       schoolInfo,
       teachers: filteredTeachers,
       attendanceData,
       formattedMonth,
       userData
     });
     toast.success(`Laporan PDF berhasil diunduh`);
   } catch (error) {
     console.error("Error generating PDF:", error);
     toast.error("Gagal mengunduh laporan PDF");
   } finally {
     setIsDownloading(false);
   }
 };
 const handleDownloadExcel = async () => {
   setIsDownloading(true);
   try {
     await generateTeacherReportExcel({
       schoolInfo,
       teachers: filteredTeachers,
       attendanceData,
       formattedMonth,
       userData,
       teacherCount
     });
     toast.success(`Laporan Excel berhasil diunduh`);
   } catch (error) {
     console.error("Error generating Excel:", error);
     toast.error("Gagal mengunduh laporan Excel");
   } finally {
     setIsDownloading(false);
   }
 };
 return (
   <div className="w-full max-w-7xl mx-auto px-3 sm:px-4 md:px-6">
     <div className="flex items-center mb-6">
       <Link href="/dashboard/absensi-guru" className="p-2 mr-2 hover:bg-gray-100 rounded-full">
         <ArrowLeft size={20} />
       </Link>
       <h1 className="text-2xl font-bold text-gray-800 bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600">
         LAPORAN ABSENSI GURU & TENAGA KEPENDIDIKAN
       </h1>
     </div>
     <div className="bg-white rounded-xl shadow-sm p-6 mb-6 border border-blue-100">
       <div className="flex flex-col space-y-3 sm:space-y-0 sm:flex-row sm:items-center sm:justify-between mb-3 sm:mb-4 md:mb-6">
         <motion.div
           className="flex items-center mb-4 md:mb-0"
           initial={{ opacity: 0, y: 20 }}
           animate={{ opacity: 1, y: 0 }}
           transition={{ duration: 0.4 }}
         >
           <div className="bg-gradient-to-br from-blue-500 to-indigo-600 p-2 rounded-lg mr-3 shadow-md">
             <Calendar className="h-6 w-6 text-white" />
           </div>
           <div>
             <h2 className="text-xl font-semibold">
               Bulan : {format(currentDate, "MMMM yyyy", { locale: id })}
             </h2>
             <p className="text-xs text-gray-500">{teacherCount} Guru & Tendik</p>
           </div>
         </motion.div>
         <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end">
           <button
             onClick={handlePrevMonth}
             className="p-2 rounded-full border border-gray-200 shadow-sm hover:bg-gray-50 transition-colors flex items-center justify-center"
           >
             <ChevronLeft size={20} className="text-blue-600" />
           </button>
           <button
             onClick={handleNextMonth}
             className="p-2 rounded-full border border-gray-200 shadow-sm hover:bg-gray-50 transition-colors flex items-center justify-center"
           >
             <ChevronRight size={20} className="text-blue-600" />
           </button>
         </div>
       </div>
       {/* Attendance Summary Cards */}
       <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
         {attendanceData.map((item, index) => (
           <motion.div
             key={item.type}
             className={`${item.color.split(" ")[0]} p-4 rounded-xl shadow-sm border border-${item.color.split(" ")[0].replace('bg-', '')}-200`}
             initial={{ opacity: 0, y: 20 }}
             animate={{ opacity: 1, y: 0 }}
             transition={{ duration: 0.3, delay: index * 0.1 }}
           >
             <h3 className="text-sm font-medium text-gray-700 mb-1">{item.type}</h3>
             <div className="flex justify-between items-end">
               <p className="text-3xl font-bold text-blue-700">
                 {loading ? (
                   <span className="animate-pulse bg-gray-200 block h-8 w-16 rounded"></span>
                 ) : (
                   `${item.value}%`
                 )}
               </p>
               <span className="text-sm text-gray-500">{item.count} kejadian</span>
             </div>
           </motion.div>
         ))}
       </div>
       {/* School Information and Table */}
       <div className="bg-gradient-to-b from-white to-blue-50 border border-blue-200 rounded-lg overflow-hidden shadow-md">
         <div className="text-center p-4">
           <h2 className="text-gray-700 sm:text-xl font-bold uppercase">{schoolInfo.name}</h2>
           <p className="text-gray-700 font-medium">{schoolInfo.address}</p>
           <p className="text-gray-700 font-medium">NPSN : {schoolInfo.npsn}</p>
         </div>
         <hr className="border-t border-blue-200 mt-1 mb-3" />
         <div className="text-center mb-4">
           <h3 className="text-gray-700 uppercase font-bold">
             REKAP LAPORAN KEHADIRAN GURU DAN TENDIK
           </h3>
           <p className="text-gray-700">
             BULAN {format(currentDate, "MMMM yyyy", { locale: id }).toUpperCase()}
           </p>
         </div>
         {error && (
           <div className="p-4 mb-4 text-center">
             <div className="flex items-center justify-center gap-2 text-red-600 mb-2">
               <AlertCircle size={20} />
               <p className="font-medium">{error}</p>
             </div>
           </div>
         )}
         {loading ? (
           <div className="flex justify-center items-center h-64">
             <Loader2 className="h-12 w-12 text-primary animate-spin" />
           </div>
         ) : (
           <div className="overflow-x-auto">
             <table className="min-w-full border">
               <thead>
                 <tr className="bg-gradient-to-r from-blue-100 to-indigo-100">
                   <th className="border px-2 py-2 text-center text-sm font-bold text-gray-700">No</th>
                   <th className="border px-2 py-2 text-center text-sm font-bold text-gray-700">Nama Guru</th>
                   <th className="border px-2 py-2 text-center text-sm font-bold text-gray-700">NIK</th>
                   <th className="border px-2 py-2 text-center text-sm font-bold text-gray-700">Jabatan</th>
                   <th className="border px-2 py-2 text-center text-sm font-bold text-gray-700">Hadir</th>
                   <th className="border px-2 py-2 text-center text-sm font-bold text-gray-700">Terlambat</th>
                   <th className="border px-2 py-2 text-center text-sm font-bold text-gray-700">Izin</th>
                   <th className="border px-2 py-2 text-center text-sm font-bold text-gray-700">Alpha</th>
                   <th className="border px-2 py-2 text-center text-sm font-bold text-gray-700">Total</th>
                 </tr>
               </thead>
               <tbody>
                 {filteredTeachers.length > 0 ? (
                   filteredTeachers.map((teacher, index) => (
                     <motion.tr
                       key={teacher.id}
                       className={index % 2 === 0 ? "bg-white" : "bg-blue-50"}
                       initial={{ opacity: 0, y: 10 }}
                       animate={{ opacity: 1, y: 0 }}
                       transition={{ duration: 0.2, delay: index * 0.03 }}
                     >
                       <td className="text-gray-600 border px-2 py-1.5 text-xs sm:text-sm text-center">
                         {index + 1}
                       </td>
                       <td className="text-gray-600 border px-2 py-1.5 text-xs sm:text-sm font-medium">
                         {teacher.name}
                       </td>
                       <td className="text-gray-600 border px-2 py-1.5 text-xs sm:text-sm text-center">
                         {teacher.nik || "-"}
                       </td>
                       <td className="text-gray-600 border px-2 py-1.5 text-xs sm:text-sm text-center">
                         {teacher.role === 'teacher' ? 'Guru' : 'Tendik'}
                       </td>
                       <td className="text-gray-600 border px-2 py-1.5 text-xs sm:text-sm text-center">
                         {teacher.hadir || 0}
                       </td>
                       <td className="text-gray-600 border px-2 py-1.5 text-xs sm:text-sm text-center">
                         {teacher.terlambat || 0}
                       </td>
                       <td className="text-gray-600 border px-2 py-1.5 text-xs sm:text-sm text-center">
                         {teacher.izin || 0}
                       </td>
                       <td className="text-gray-600 border px-2 py-1.5 text-xs sm:text-sm text-center">
                         {teacher.alpha || 0}
                       </td>
                       <td className="text-gray-600 border px-2 py-1.5 text-xs sm:text-sm text-center font-medium">
                         {(teacher.hadir || 0) + (teacher.terlambat || 0) + (teacher.izin || 0) + (teacher.alpha || 0)}
                       </td>
                     </motion.tr>
                   ))
                 ) : (
                   <tr>
                     <td colSpan={9} className="border px-4 py-8 text-center text-gray-500">
                       <div className="flex flex-col items-center justify-center gap-2">
                         <AlertCircle size={24} className="text-blue-400" />
                         <span>Tidak ada data kehadiran yang ditemukan</span>
                       </div>
                     </td>
                   </tr>
                 )}
                 {/* Total row */}
                 {filteredTeachers.length > 0 && (
                   <tr className="bg-gradient-to-r from-blue-200 to-indigo-200 font-medium">
                     <td colSpan={4} className="border px-2 py-2.5 font-bold text-sm text-center">
                       TOTAL
                     </td>
                     <td className="border px-2 py-2.5 text-center font-bold text-sm">
                       {filteredTeachers.reduce((sum, teacher) => sum + (teacher.hadir || 0), 0)}
                     </td>
                     <td className="border px-2 py-2.5 text-center font-bold text-sm">
                       {filteredTeachers.reduce((sum, teacher) => sum + (teacher.terlambat || 0), 0)}
                     </td>
                     <td className="border px-2 py-2.5 text-center font-bold text-sm">
                       {filteredTeachers.reduce((sum, teacher) => sum + (teacher.izin || 0), 0)}
                     </td>
                     <td className="border px-2 py-2.5 text-center font-bold text-sm">
                       {filteredTeachers.reduce((sum, teacher) => sum + (teacher.alpha || 0), 0)}
                     </td>
                     <td className="border px-2 py-2.5 text-center font-bold text-sm">
                       {filteredTeachers.reduce((sum, teacher) => sum + ((teacher.hadir || 0) + (teacher.terlambat || 0) + (teacher.izin || 0) + (teacher.alpha || 0)), 0)}
                     </td>
                   </tr>
                 )}
               </tbody>
             </table>
           </div>
         )}
       </div>
     </div>
     <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 mb-20 md:mb-6">
       <motion.button
         onClick={handleDownloadPDF}
         disabled={isDownloading || loading}
         className="flex items-center justify-center gap-3 bg-gradient-to-r from-red-500 to-red-600 text-white p-4 rounded-xl hover:from-red-600 hover:to-red-700 transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
         whileHover={{ scale: 1.02 }}
         whileTap={{ scale: 0.98 }}
       >
         {isDownloading ? (
           <Loader2 className="h-6 w-6 animate-spin" />
         ) : (
           <FileText className="h-6 w-6" />
         )}
         <span className="font-medium">Download Laporan PDF</span>
       </motion.button>
       <motion.button
         onClick={handleDownloadExcel}
         disabled={isDownloading || loading}
         className="flex items-center justify-center gap-3 bg-gradient-to-r from-green-500 to-green-600 text-white p-4 rounded-xl hover:from-green-600 hover:to-green-700 transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
         whileHover={{ scale: 1.02 }}
         whileTap={{ scale: 0.98 }}
       >
         {isDownloading ? (
           <Loader2 className="h-6 w-6 animate-spin" />
         ) : (
           <FileSpreadsheet className="h-6 w-6" />
         )}
         <span className="font-medium">Download Laporan Excel</span>
       </motion.button>
     </div>
   </div>
 );
}