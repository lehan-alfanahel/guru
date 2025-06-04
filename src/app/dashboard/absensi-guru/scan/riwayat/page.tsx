"use client";
import React, { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { QrCode, User, Calendar, Clock, CheckCircle, FileText, AlertTriangle, BarChart2 } from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";
import { id } from "date-fns/locale";
import { collection, query, where, orderBy, limit, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
export default function TeacherAttendanceDashboard() {
 const { user, schoolId, userRole } = useAuth();
 const [todayAttendance, setTodayAttendance] = useState<any>(null);
 const [recentAttendances, setRecentAttendances] = useState<any[]>([]);
 const [loading, setLoading] = useState<boolean>(true);

 // Current date in Indonesian format
 const currentDate = new Date();
 const formattedDate = format(currentDate, "EEEE, d MMMM yyyy", { locale: id });

 useEffect(() => {
   const fetchTeacherAttendance = async () => {
     if (!schoolId || !user) {
       setLoading(false);
       return;
     }

     try {
       setLoading(true);
       const today = format(new Date(), "yyyy-MM-dd");

       // Fetch today's attendance
       const todayAttendanceRef = collection(db, `schools/${schoolId}/teacher-attendance`);
       const todayAttendanceQuery = query(
         todayAttendanceRef,
         where("teacherId", "==", user.uid),
         where("date", "==", today),
         orderBy("timestamp", "desc"),
         limit(1)
       );

       const todayAttendanceSnapshot = await getDocs(todayAttendanceQuery);
       if (!todayAttendanceSnapshot.empty) {
         setTodayAttendance({
           id: todayAttendanceSnapshot.docs[0].id,
           ...todayAttendanceSnapshot.docs[0].data()
         });
       }

       // Fetch recent attendance records
       const recentAttendanceRef = collection(db, `schools/${schoolId}/teacher-attendance`);
       const recentAttendanceQuery = query(
         recentAttendanceRef,
         where("teacherId", "==", user.uid),
         orderBy("timestamp", "desc"),
         limit(5)
       );

       const recentAttendanceSnapshot = await getDocs(recentAttendanceQuery);
       const recentAttendanceData: any[] = [];

       recentAttendanceSnapshot.forEach(doc => {
         recentAttendanceData.push({
           id: doc.id,
           ...doc.data()
         });
       });

       setRecentAttendances(recentAttendanceData);
       setLoading(false);
     } catch (error) {
       console.error("Error fetching attendance data:", error);
       setLoading(false);
     }
   };

   fetchTeacherAttendance();
 }, [schoolId, user]);

 // Get status badge color
 const getStatusBadgeClass = (status: string) => {
   switch (status) {
     case 'hadir':
       return 'bg-green-100 text-green-800';
     case 'izin':
       return 'bg-amber-100 text-amber-800';
     case 'alpha':
       return 'bg-red-100 text-red-800';
     default:
       return 'bg-gray-100 text-gray-800';
   }
 };
 return (
   <div className="w-full max-w-6xl mx-auto pb-20 md:pb-6 px-3 sm:px-4 md:px-6">
     <h1 className="text-2xl font-bold mb-2 text-gray-800">Absensi Guru</h1>
     <p className="text-gray-600 mb-6">{formattedDate}</p>

     {/* Today's attendance status */}
     <div className={`${
       todayAttendance
         ? todayAttendance.status === 'hadir'
           ? 'bg-green-500'
           : todayAttendance.status === 'izin'
             ? 'bg-amber-500'
             : 'bg-red-500'
         : 'bg-gray-500'
     } rounded-xl shadow-sm p-6 mb-6 text-white`}>
       <div className="flex flex-col md:flex-row md:items-center md:justify-between">
         <div>
           <div className="flex items-center">
             <Calendar className="h-5 w-5 text-white mr-2" />
             <h2 className="text-lg font-semibold text-white">Status Absensi Hari Ini</h2>
           </div>
           <p className="text-white/90 mt-1">{formattedDate}</p>
         </div>

         {todayAttendance ? (
           <div className="mt-4 md:mt-0 flex items-center bg-white/20 px-4 py-2 rounded-lg">
             {todayAttendance.status === 'hadir' && <CheckCircle className="h-5 w-5 text-white mr-2" />}
             {todayAttendance.status === 'izin' && <FileText className="h-5 w-5 text-white mr-2" />}
             {todayAttendance.status === 'alpha' && <AlertTriangle className="h-5 w-5 text-white mr-2" />}

             <span className="font-medium text-white">
               {todayAttendance.status === 'hadir' ? 'Hadir' :
                todayAttendance.status === 'izin' ? 'Izin' : 'Alpha'}
             </span>
             <span className="text-white/90 ml-2 text-sm">{todayAttendance.time}</span>
           </div>
         ) : (
           <div className="mt-4 md:mt-0 flex items-center bg-white/20 px-4 py-2 rounded-lg">
             <AlertTriangle className="h-5 w-5 text-white mr-2" />
             <span className="font-medium text-white">Belum Absen</span>
           </div>
         )}
       </div>

       {/* Show reason for Izin status */}
       {todayAttendance && todayAttendance.status === 'izin' && todayAttendance.reason && (
         <div className="mt-4 bg-white/10 p-3 rounded-lg">
           <p className="text-sm text-white/90">Alasan: {todayAttendance.reason}</p>
         </div>
       )}
     </div>

     {/* Quick Action Cards */}
     <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
       <Link href="/dashboard/absensi-guru/scan" className="bg-primary rounded-xl shadow-sm p-6 hover:shadow-md transition-all text-white">
         <div className="flex items-center">
           <div className="bg-white/20 p-3 rounded-lg mr-4">
             <QrCode className="h-6 w-6 text-white" />
           </div>
           <div>
             <h3 className="font-semibold">Absen Sekarang</h3>
             <p className="text-sm text-white/80 mt-1">Absensi dengan selfie & lokasi</p>
           </div>
         </div>
       </Link>

       <Link href="/dashboard/absensi-guru/reports" className="bg-secondary rounded-xl shadow-sm p-6 hover:shadow-md transition-all text-white">
         <div className="flex items-center">
           <div className="bg-white/20 p-3 rounded-lg mr-4">
             <BarChart2 className="h-6 w-6 text-white" />
           </div>
           <div>
             <h3 className="font-semibold">Laporan Absensi</h3>
             <p className="text-sm text-white/80 mt-1">Lihat rekap kehadiran Anda</p>
           </div>
         </div>
       </Link>
     </div>

     {/* Recent Attendance History */}
     <div className="bg-white rounded-xl shadow-sm p-6">
       <h2 className="text-lg font-semibold mb-4">Riwayat Absensi Terbaru</h2>

       {loading ? (
         <div className="flex justify-center items-center h-40">
           <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
         </div>
       ) : recentAttendances.length > 0 ? (
         <div className="divide-y divide-gray-100">
           {recentAttendances.map((attendance) => (
             <div key={attendance.id} className="py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between">
               <div>
                 <div className="flex items-center">
                   <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadgeClass(attendance.status)}`}>
                     {attendance.status === 'hadir' ? 'Hadir' :
                      attendance.status === 'izin' ? 'Izin' : 'Alpha'}
                   </span>
                   <span className="ml-2 text-gray-500 text-sm">{attendance.time}</span>
                 </div>
                 <p className="mt-1 text-sm">
                   {format(new Date(attendance.date.split('-').join('/')), "d MMMM yyyy", { locale: id })}
                 </p>

                 {attendance.status === 'izin' && attendance.reason && (
                   <p className="mt-1 text-sm text-gray-600">Alasan: {attendance.reason}</p>
                 )}
               </div>

               {attendance.status === 'alpha' && attendance.autoGenerated && (
                 <span className="mt-2 sm:mt-0 text-xs text-red-600 bg-red-50 px-2 py-1 rounded-md">
                   Otomatis
                 </span>
               )}
             </div>
           ))}
         </div>
       ) : (
         <div className="text-center py-8">
           <p className="text-gray-500">Belum ada riwayat absensi</p>
         </div>
       )}

       <div className="mt-6">
         <Link href="/dashboard/absensi-guru/attendance-table"
           className="text-primary hover:text-primary/90 font-medium text-sm flex items-center justify-center"
         >
           Lihat Semua Riwayat Absensi
         </Link>
       </div>
     </div>
   </div>
 );
}