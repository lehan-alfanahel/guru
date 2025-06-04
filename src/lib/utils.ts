import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
export function cn(...inputs: ClassValue[]) {
 return twMerge(clsx(inputs))
}
export function checkUserPermission(userRole: string | null, requiredRole: string | string[]): boolean {
 if (!userRole) return false;

 const roles = typeof requiredRole === 'string' ? [requiredRole] : requiredRole;

 // Admin can access everything
 if (userRole === 'admin') return true;

 return roles.includes(userRole);
}
export function getRoleLabel(role: string | null): string {
 switch (role) {
   case 'admin':
     return 'Administrator';
   case 'teacher':
     return 'Guru';
   case 'student':
     return 'Siswa';
   default:
     return 'Pengguna';
 }
}
export async function markTeachersAsAbsent(schoolId: string) {
 if (!schoolId) return;

 try {
   const { db } = await import('@/lib/firebase');
   const { collection, query, where, getDocs, addDoc, serverTimestamp } = await import('firebase/firestore');

   // Get current date
   const currentDate = new Date();
   const dateStr = currentDate.toISOString().split('T')[0]; // YYYY-MM-DD
   const timeStr = currentDate.toLocaleTimeString('id-ID', {
     hour: '2-digit',
     minute: '2-digit',
     second: '2-digit',
     hour12: false
   });

   // Get all teachers and staff
   const usersRef = collection(db, "users");
   const teacherQuery = query(usersRef, where("schoolId", "==", schoolId), where("role", "in", ["teacher", "staff"]));
   const teachersSnapshot = await getDocs(teacherQuery);

   // For each teacher/staff
   const markingPromises = teachersSnapshot.docs.map(async (teacherDoc) => {
     const teacherData = teacherDoc.data();
     const teacherId = teacherDoc.id;

     // Check if teacher has attendance record for today
     const attendanceRef = collection(db, "teacherAttendance");

     // Check for 'in' attendance
     const inAttendanceQuery = query(
       attendanceRef,
       where("teacherId", "==", teacherId),
       where("date", "==", dateStr),
       where("type", "==", "in")
     );
     const inSnapshot = await getDocs(inAttendanceQuery);

     // If no 'in' attendance record exists
     if (inSnapshot.empty) {
       // Create an alpha record
       const alphaData = {
         teacherId: teacherId,
         teacherName: teacherData.name || "Unknown",
         teacherNik: teacherData.nik || "Unknown",
         date: dateStr,
         time: timeStr,
         timestamp: serverTimestamp(),
         type: "in", // missing check-in
         status: "alpha",
         location: {
           lat: 0,
           lng: 0
         },
         schoolId: schoolId,
         note: "Tidak melakukan absensi masuk"
       };

       await addDoc(attendanceRef, alphaData);

       // Send Telegram notification about absence
       await sendAbsenceNotification(teacherData.name, dateStr, "in");
     }

     // Check for 'out' attendance (can be done for afternoon/evening check)
     const outAttendanceQuery = query(
       attendanceRef,
       where("teacherId", "==", teacherId),
       where("date", "==", dateStr),
       where("type", "==", "out")
     );
     const outSnapshot = await getDocs(outAttendanceQuery);

     // If no 'out' attendance record exists and it's after work hours (e.g., after 4 PM)
     if (outSnapshot.empty && currentDate.getHours() >= 16) {
       // Create an alpha record for missing check-out
       const alphaData = {
         teacherId: teacherId,
         teacherName: teacherData.name || "Unknown",
         teacherNik: teacherData.nik || "Unknown",
         date: dateStr,
         time: timeStr,
         timestamp: serverTimestamp(),
         type: "out", // missing check-out
         status: "alpha",
         location: {
           lat: 0,
           lng: 0
         },
         schoolId: schoolId,
         note: "Tidak melakukan absensi pulang"
       };

       await addDoc(attendanceRef, alphaData);

       // Send Telegram notification about absence
       await sendAbsenceNotification(teacherData.name, dateStr, "out");
     }
   });

   await Promise.all(markingPromises);
   return { success: true, message: "Alpha statuses marked successfully" };
 } catch (error) {
   console.error("Error marking teachers as absent:", error);
   return { success: false, message: "Failed to mark alpha statuses" };
 }
}
async function sendAbsenceNotification(teacherName: string, date: string, type: string) {
 try {
   const { doc, getDoc } = await import('firebase/firestore');
   const { db } = await import('@/lib/firebase');

   // Get Telegram settings
   const telegramSettingsDoc = await getDoc(doc(db, "settings", "telegram"));
   if (!telegramSettingsDoc.exists()) return;

   const telegramSettings = telegramSettingsDoc.data();
   const token = telegramSettings.token || "7702797779:AAELhARB3HkvB9hh5e5D64DCC4faDfcW9IM";
   const chatId = telegramSettings.chatId || "";

   if (!chatId) return;

   // Format message
   const messageType = type === 'in' ? 'MASUK' : 'PULANG';
   const message = `GTK dengan nama ${teacherName} TIDAK melakukan absensi ${messageType} pada tanggal ${date}. Status: ALPHA.`;

   // Send notification
   await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
     method: 'POST',
     headers: {
       'Content-Type': 'application/json'
     },
     body: JSON.stringify({
       chat_id: chatId,
       text: message
     })
   });
 } catch (error) {
   console.error("Error sending absence notification:", error);
 }
}
