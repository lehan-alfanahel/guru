"use client";
import { jsPDF } from "jspdf";
import * as XLSX from "xlsx";
import { format } from "date-fns";
import { id } from "date-fns/locale";
interface SchoolInfo {
 name: string;
 address: string;
 npsn: string;
 principalName: string;
 principalNip?: string;
}
interface TeacherData {
 id: string;
 name: string;
 nik: string;
 role: string;
 hadir: number;
 terlambat: number;
 izin: number;
 alpha: number;
 total: number;
}
interface ReportParams {
 schoolInfo: SchoolInfo;
 teachers: TeacherData[];
 attendanceData: any[];
 formattedMonth: string;
 userData?: any;
}
export const generateTeacherReportPDF = async (params: ReportParams) => {
 const { schoolInfo, teachers, formattedMonth, userData } = params;
 const pdfDoc = new jsPDF({
   orientation: "portrait",
   unit: "mm",
   format: "a4"
 });
 const pageWidth = pdfDoc.internal.pageSize.getWidth();
 const pageHeight = pdfDoc.internal.pageSize.getHeight();
 const margin = 15;
 // Add header with school information
 pdfDoc.setFontSize(16);
 pdfDoc.setFont("helvetica", "bold");
 pdfDoc.text(schoolInfo.name.toUpperCase(), pageWidth / 2, margin, { align: "center" });

 pdfDoc.setFontSize(12);
 pdfDoc.setFont("helvetica", "normal");
 pdfDoc.text(schoolInfo.address, pageWidth / 2, margin + 7, { align: "center" });
 pdfDoc.text(`NPSN: ${schoolInfo.npsn}`, pageWidth / 2, margin + 14, { align: "center" });
 // Add horizontal line
 pdfDoc.setLineWidth(0.5);
 pdfDoc.line(margin, margin + 20, pageWidth - margin, margin + 20);
 // Add title
 pdfDoc.setFontSize(12);
 pdfDoc.setFont("helvetica", "normal");
 pdfDoc.text("REKAPITULASI LAPORAN ABSENSI GURU DAN TENAGA KEPENDIDIKAN", pageWidth / 2, margin + 30, { align: "center" });
 pdfDoc.text(`BULAN ${formattedMonth.toUpperCase()}`, pageWidth / 2, margin + 36, { align: "center" });
 // Main attendance table
 let yPos = margin + 43;
 // Table headers
 const headers = ["NO.", "NAMA GURU", "NIK", "JABATAN", "HADIR", "TERLAMBAT", "IZIN", "ALPHA", "TOTAL"];
 const colWidths = [12, 50, 25, 20, 17, 25, 15, 17, 20];
 // Draw table header - Light blue background
 pdfDoc.setFillColor(173, 216, 230);
 pdfDoc.rect(margin, yPos, pageWidth - margin * 2, 8, "F");
 pdfDoc.setDrawColor(0);
 pdfDoc.rect(margin, yPos, pageWidth - margin * 2, 8, "S");
 let xPos = margin;
 pdfDoc.setFontSize(9);
 pdfDoc.setTextColor(0);
 // Draw vertical lines and headers
 headers.forEach((header, i) => {
   if (i > 0) {
     pdfDoc.line(xPos, yPos, xPos, yPos + 8);
   }
   pdfDoc.text(header, xPos + colWidths[i] / 2, yPos + 5.5, { align: "center" });
   xPos += colWidths[i];
 });
 yPos += 8;
 // Draw table rows
 pdfDoc.setFontSize(10);
 let totalHadir = 0, totalTerlambat = 0, totalIzin = 0, totalAlpha = 0, totalAll = 0;
 // Process each teacher's data
 teachers.forEach((teacher, index) => {
   // Row background (alternating)
   if (index % 2 === 0) {
     pdfDoc.setFillColor(240, 240, 240);
     pdfDoc.rect(margin, yPos, pageWidth - margin * 2, 7, "F");
   }
   // Draw row border
   pdfDoc.rect(margin, yPos, pageWidth - margin * 2, 7, "S");
   // Calculate totals
   totalHadir += teacher.hadir || 0;
   totalTerlambat += teacher.terlambat || 0;
   totalIzin += teacher.izin || 0;
   totalAlpha += teacher.alpha || 0;
   const teacherTotal = (teacher.hadir || 0) + (teacher.terlambat || 0) + (teacher.izin || 0) + (teacher.alpha || 0);
   totalAll += teacherTotal;
   // Draw cell content
   xPos = margin;
   // Number
   pdfDoc.text((index + 1).toString(), xPos + colWidths[0] / 2, yPos + 5, { align: "center" });
   xPos += colWidths[0];
   // Draw vertical line
   pdfDoc.line(xPos, yPos, xPos, yPos + 7);
   // Name - truncate if too long
   const displayName = teacher.name.length > 25 ? teacher.name.substring(0, 22) + "..." : teacher.name;
   pdfDoc.text(displayName || "", xPos + 2, yPos + 5);
   xPos += colWidths[1];
   // Draw vertical line
   pdfDoc.line(xPos, yPos, xPos, yPos + 7);
   pdfDoc.text(teacher.nik || "", xPos + colWidths[2] / 2, yPos + 5, { align: "center" });
   xPos += colWidths[2];
   // Draw vertical line
   pdfDoc.line(xPos, yPos, xPos, yPos + 7);
   const roleText = teacher.role === 'teacher' ? 'Guru' : 'Tendik';
   pdfDoc.text(roleText, xPos + colWidths[3] / 2, yPos + 5, { align: "center" });
   xPos += colWidths[3];
   // Draw vertical line
   pdfDoc.line(xPos, yPos, xPos, yPos + 7);
   pdfDoc.text((teacher.hadir || 0).toString(), xPos + colWidths[4] / 2, yPos + 5, { align: "center" });
   xPos += colWidths[4];
   // Draw vertical line
   pdfDoc.line(xPos, yPos, xPos, yPos + 7);
   pdfDoc.text((teacher.terlambat || 0).toString(), xPos + colWidths[5] / 2, yPos + 5, { align: "center" });
   xPos += colWidths[5];
   // Draw vertical line
   pdfDoc.line(xPos, yPos, xPos, yPos + 7);
   pdfDoc.text((teacher.izin || 0).toString(), xPos + colWidths[6] / 2, yPos + 5, { align: "center" });
   xPos += colWidths[6];
   // Draw vertical line
   pdfDoc.line(xPos, yPos, xPos, yPos + 7);
   pdfDoc.text((teacher.alpha || 0).toString(), xPos + colWidths[7] / 2, yPos + 5, { align: "center" });
   xPos += colWidths[7];
   // Draw vertical line
   pdfDoc.line(xPos, yPos, xPos, yPos + 7);
   pdfDoc.text(teacherTotal.toString(), xPos + colWidths[8] / 2, yPos + 5, { align: "center" });
   // Draw horizontal line at bottom of row
   pdfDoc.line(margin, yPos + 7, margin + pageWidth - margin * 2, yPos + 7);
   yPos += 7;
   // Add a new page if needed
   if (yPos > pageHeight - margin - 100 && index < teachers.length - 1) {
     pdfDoc.addPage();
     yPos = margin + 30;
     // Redraw table header on new page
     pdfDoc.setFillColor(173, 216, 230);
     pdfDoc.rect(margin, yPos, pageWidth - margin * 2, 8, "F");
     pdfDoc.rect(margin, yPos, pageWidth - margin * 2, 8, "S");

     xPos = margin;
     headers.forEach((header, i) => {
       if (i > 0) {
         pdfDoc.line(xPos, yPos, xPos, yPos + 8);
       }
       pdfDoc.text(header, xPos + colWidths[i] / 2, yPos + 5.5, { align: "center" });
       xPos += colWidths[i];
     });
     yPos += 8;
   }
 });
 // Add total row
 pdfDoc.setFillColor(200, 200, 200);
 pdfDoc.rect(margin, yPos, pageWidth - margin * 2, 8, "F");
 pdfDoc.rect(margin, yPos, pageWidth - margin * 2, 8, "S");
 xPos = margin;
 pdfDoc.setFont("helvetica", "bold");
 // Total text
 pdfDoc.text("TOTAL", xPos + colWidths[0] / 2 + colWidths[1] / 2, yPos + 5, { align: "center" });
 xPos += colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3];
 // Draw vertical line
 pdfDoc.line(xPos, yPos, xPos, yPos + 8);
 pdfDoc.text(totalHadir.toString(), xPos + colWidths[4] / 2, yPos + 5, { align: "center" });
 xPos += colWidths[4];
 // Draw vertical line
 pdfDoc.line(xPos, yPos, xPos, yPos + 8);
 pdfDoc.text(totalTerlambat.toString(), xPos + colWidths[5] / 2, yPos + 5, { align: "center" });
 xPos += colWidths[5];
 // Draw vertical line
 pdfDoc.line(xPos, yPos, xPos, yPos + 8);
 pdfDoc.text(totalIzin.toString(), xPos + colWidths[6] / 2, yPos + 5, { align: "center" });
 xPos += colWidths[6];
 // Draw vertical line
 pdfDoc.line(xPos, yPos, xPos, yPos + 8);
 pdfDoc.text(totalAlpha.toString(), xPos + colWidths[7] / 2, yPos + 5, { align: "center" });
 xPos += colWidths[7];
 // Draw vertical line
 pdfDoc.line(xPos, yPos, xPos, yPos + 8);
 pdfDoc.text(totalAll.toString(), xPos + colWidths[8] / 2, yPos + 5, { align: "center" });
 yPos += 18;
 // Get top teachers by category
 const getTopTeachersByCategory = () => {
   const sortedByHadir = [...teachers].sort((a, b) => (b.hadir || 0) - (a.hadir || 0)).slice(0, 3);
   const sortedByTerlambat = [...teachers].sort((a, b) => (b.terlambat || 0) - (a.terlambat || 0)).slice(0, 3);
   const sortedByIzin = [...teachers].sort((a, b) => (b.izin || 0) - (a.izin || 0)).slice(0, 3);
   const sortedByAlpha = [...teachers].sort((a, b) => (b.alpha || 0) - (a.alpha || 0)).slice(0, 3);
   return {
     hadir: sortedByHadir,
     terlambat: sortedByTerlambat,
     izin: sortedByIzin,
     alpha: sortedByAlpha
   };
 };
 const topTeachersByCategory = getTopTeachersByCategory();
 // Add sections for teachers with most attendance in each category
 const addTeacherCategorySection = (title: string, teachers: TeacherData[], startY: number) => {
   pdfDoc.setFontSize(10);
   pdfDoc.setFont("helvetica", "normal");
   pdfDoc.text(title + " Terbanyak :", margin, startY);
   const tableHeaders = ["No.", "Nama", "NIK", "Jabatan", "Jumlah"];
   const colWidths = [10, 55, 38, 23, 27];
   let yPosition = startY + 5;
   // Draw header row
   pdfDoc.setFillColor(173, 216, 230);
   pdfDoc.rect(margin, yPosition, colWidths.reduce((a, b) => a + b, 0), 8, "F");
   pdfDoc.rect(margin, yPosition, colWidths.reduce((a, b) => a + b, 0), 8, "S");
   let xPosition = margin;
   // Draw column headers
   tableHeaders.forEach((header, i) => {
     if (i > 0) {
       pdfDoc.line(xPosition, yPosition, xPosition, yPosition + 8);
     }
     pdfDoc.text(header, xPosition + colWidths[i] / 2, yPosition + 5, { align: "center" });
     xPosition += colWidths[i];
   });
   yPosition += 8;
   // Draw rows
   pdfDoc.setFont("helvetica", "normal");
   teachers.forEach((teacher, index) => {
     // Draw row border
     pdfDoc.rect(margin, yPosition, colWidths.reduce((a, b) => a + b, 0), 8, "S");
     xPosition = margin;
     // Number
     pdfDoc.text((index + 1).toString(), xPosition + colWidths[0] / 2, yPosition + 5, { align: "center" });
     xPosition += colWidths[0];
     pdfDoc.line(xPosition, yPosition, xPosition, yPosition + 8);
     // Name - truncate if too long
     const displayName = teacher.name.length > 25 ? teacher.name.substring(0, 22) + "..." : teacher.name;
     pdfDoc.text(displayName || "", xPosition + 2, yPosition + 5);
     xPosition += colWidths[1];
     pdfDoc.line(xPosition, yPosition, xPosition, yPosition + 8);
     // NIK
     pdfDoc.text(teacher.nik || "", xPosition + colWidths[2] / 2, yPosition + 5, { align: "center" });
     xPosition += colWidths[2];
     pdfDoc.line(xPosition, yPosition, xPosition, yPosition + 8);
     // Role
     const roleText = teacher.role === 'teacher' ? 'Guru' : 'Tendik';
     pdfDoc.text(roleText, xPosition + colWidths[3] / 2, yPosition + 5, { align: "center" });
     xPosition += colWidths[3];
     pdfDoc.line(xPosition, yPosition, xPosition, yPosition + 8);
     // Count - varies depending on section type
     let count = 0;
     switch (title) {
       case "Guru/Tendik dengan Hadir":
         count = teacher.hadir || 0;
         break;
       case "Guru/Tendik dengan Terlambat":
         count = teacher.terlambat || 0;
         break;
       case "Guru/Tendik dengan Izin":
         count = teacher.izin || 0;
         break;
       case "Guru/Tendik dengan Alpha":
         count = teacher.alpha || 0;
         break;
     }
     pdfDoc.text(count.toString(), xPosition + colWidths[4] / 2, yPosition + 5, { align: "center" });
     yPosition += 8;
   });
   return yPosition;
 };
 // Check if we need a new page for the teacher sections
 if (yPos + 120 > pageHeight) {
   pdfDoc.addPage();
   yPos = margin + 20;
 }
 // Teachers with most "Hadir"
 yPos = addTeacherCategorySection("Guru/Tendik dengan Hadir", topTeachersByCategory.hadir, yPos) + 8;
 // Teachers with most "Terlambat"
 yPos = addTeacherCategorySection("Guru/Tendik dengan Terlambat", topTeachersByCategory.terlambat, yPos) + 8;
 // Check if we need a new page for the remaining sections
 if (yPos + 80 > pageHeight) {
   pdfDoc.addPage();
   yPos = margin + 20;
 }
 // Teachers with most "Izin"
 yPos = addTeacherCategorySection("Guru/Tendik dengan Izin", topTeachersByCategory.izin, yPos) + 8;
 // Teachers with most "Alpha"
 yPos = addTeacherCategorySection("Guru/Tendik dengan Alpha", topTeachersByCategory.alpha, yPos) + 12;
 // Add signature section
 yPos += 5;
 // Signature layout
 const signatureWidth = (pageWidth - margin * 2) / 2;
 pdfDoc.setFontSize(10);
 pdfDoc.setFont("helvetica", "normal");
 pdfDoc.text("Mengetahui", signatureWidth * 0.25 + margin, yPos, { align: "center" });
 pdfDoc.text("Administrator Sekolah", signatureWidth * 1.75 + margin, yPos, { align: "center" });
 yPos += 5;
 pdfDoc.text("KEPALA SEKOLAH,", signatureWidth * 0.25 + margin, yPos, { align: "center" });
 pdfDoc.text("Absensi Digital,", signatureWidth * 1.75 + margin, yPos, { align: "center" });
 yPos += 20;
 pdfDoc.text(schoolInfo.principalName || "Kepala Sekolah", signatureWidth * 0.25 + margin, yPos, { align: "center" });
 pdfDoc.text(userData?.name || "Administrator", signatureWidth * 1.75 + margin, yPos, { align: "center" });
 yPos += 5;
 pdfDoc.text(`NIP. ${schoolInfo.principalNip || "................................"}`, signatureWidth * 0.25 + margin, yPos, { align: "center" });
 pdfDoc.text("NIP. ....................................", signatureWidth * 1.75 + margin, yPos, { align: "center" });
 // Save the PDF
 const fileName = `Rekap_Kehadiran_Guru_${formattedMonth.replace(' ', '_')}.pdf`;
 pdfDoc.save(fileName);
 return fileName;
};
export const generateTeacherReportExcel = async (params: ReportParams & { teacherCount: number }) => {
 const { schoolInfo, teachers, formattedMonth, userData, teacherCount } = params;
 // Dynamically import xlsx library
 const XLSX = await import('xlsx');
 // Format current month name properly
 const monthName = formattedMonth.toUpperCase();
 // Create header data with school information
 const headerData = [
   [schoolInfo.name.toUpperCase()],
   [schoolInfo.address],
   [`NPSN: ${schoolInfo.npsn}`],
   [""],
   ["REKAPITULASI LAPORAN ABSENSI GURU DAN TENAGA KEPENDIDIKAN"],
   [`BULAN ${monthName}`],
   [`TOTAL GURU & TENDIK: ${teacherCount}`],
   [""],
   ["No.", "Nama Guru/Tendik", "NIK", "Jabatan", "Hadir", "Terlambat", "Izin", "Alpha", "Total"]
 ];
 // Calculate totals for summary
 let totalHadir = 0;
 let totalTerlambat = 0;
 let totalIzin = 0;
 let totalAlpha = 0;
 let totalAll = 0;
 // Add teacher data
 teachers.forEach((teacher, index) => {
   const teacherHadir = teacher.hadir || 0;
   const teacherTerlambat = teacher.terlambat || 0;
   const teacherIzin = teacher.izin || 0;
   const teacherAlpha = teacher.alpha || 0;
   const teacherTotal = teacherHadir + teacherTerlambat + teacherIzin + teacherAlpha;
   const roleText = teacher.role === 'teacher' ? 'Guru' : 'Tendik';
   // Add to totals
   totalHadir += teacherHadir;
   totalTerlambat += teacherTerlambat;
   totalIzin += teacherIzin;
   totalAlpha += teacherAlpha;
   totalAll += teacherTotal;
   headerData.push([
     index + 1,
     teacher.name || "nama guru/tendik",
     teacher.nik || "nip/nik",
     roleText,
     teacherHadir,
     teacherTerlambat,
     teacherIzin,
     teacherAlpha,
     teacherTotal
   ]);
 });
 // Add total row
 headerData.push([
   "Total", "", "", "",
   totalHadir.toString(),
   totalTerlambat.toString(),
   totalIzin.toString(),
   totalAlpha.toString(),
   totalAll.toString()
 ]);
 // Add empty rows
 headerData.push([]);
 headerData.push([]);
 // Get top teachers by category
 const topTeachersByHadir = [...teachers].sort((a, b) => (b.hadir || 0) - (a.hadir || 0)).slice(0, 3);
 const topTeachersByTerlambat = [...teachers].sort((a, b) => (b.terlambat || 0) - (a.terlambat || 0)).slice(0, 3);
 const topTeachersByIzin = [...teachers].sort((a, b) => (b.izin || 0) - (a.izin || 0)).slice(0, 3);
 const topTeachersByAlpha = [...teachers].sort((a, b) => (b.alpha || 0) - (a.alpha || 0)).slice(0, 3);
 // Add "Guru/Tendik dengan Hadir Terbanyak" section
 headerData.push(["Guru/Tendik dengan Hadir Terbanyak :"]);
 headerData.push(["No.", "Nama", "NIP/NIK", "Jabatan", "Jumlah"]);
 topTeachersByHadir.forEach((teacher, index) => {
   headerData.push([
     index + 1,
     teacher.name || "nama",
     teacher.nik || "nip/nik",
     teacher.role === 'teacher' ? 'Guru' : 'Tendik',
     teacher.hadir || 0
   ]);
 });
 // Add empty row
 headerData.push([]);
 // Add "Guru/Tendik dengan Terlambat Terbanyak" section
 headerData.push(["Guru/Tendik dengan Terlambat Terbanyak :"]);
 headerData.push(["No.", "Nama", "NIP/NIK", "Jabatan", "Jumlah"]);
 topTeachersByTerlambat.forEach((teacher, index) => {
   headerData.push([
     index + 1,
     teacher.name || "nama",
     teacher.nik || "nip/nik",
     teacher.role === 'teacher' ? 'Guru' : 'Tendik',
     teacher.terlambat || 0
   ]);
 });
 // Add empty row
 headerData.push([]);
 // Add "Guru/Tendik dengan Izin Terbanyak" section
 headerData.push(["Guru/Tendik dengan Izin Terbanyak :"]);
 headerData.push(["No.", "Nama", "NIP/NIK", "Jabatan", "Jumlah"]);
 topTeachersByIzin.forEach((teacher, index) => {
   headerData.push([
     index + 1,
     teacher.name || "nama",
     teacher.nik || "nip/nik",
     teacher.role === 'teacher' ? 'Guru' : 'Tendik',
     teacher.izin || 0
   ]);
 });
 // Add empty row
 headerData.push([]);
 // Add "Guru/Tendik dengan Alpha Terbanyak" section
 headerData.push(["Guru/Tendik dengan Alpha Terbanyak :"]);
 headerData.push(["No.", "Nama", "NIP/NIK", "Jabatan", "Jumlah"]);
 topTeachersByAlpha.forEach((teacher, index) => {
   headerData.push([
     index + 1,
     teacher.name || "nama",
     teacher.nik || "nip/nik",
     teacher.role === 'teacher' ? 'Guru' : 'Tendik',
     teacher.alpha || 0
   ]);
 });
 // Add signature section
 headerData.push([]);
 headerData.push([]);
 headerData.push([]);
 // Add signature
 const currentDateFormatted = format(new Date(), "d MMMM yyyy", { locale: id });
 headerData.push([`${schoolInfo.address}, ${currentDateFormatted}`]);
 headerData.push([]);
 headerData.push(["", "Mengetahui", "", "", "", "", "", "Administrator Sekolah"]);
 headerData.push(["", "KEPALA SEKOLAH,", "", "", "", "", "", "Nama Sekolah,"]);
 headerData.push([]);
 headerData.push([]);
 headerData.push([]);
 headerData.push(["", schoolInfo.principalName, "", "", "", "", "", userData?.name || "Administrator"]);
 headerData.push(["", `NIP. ${schoolInfo.principalNip}`, "", "", "", "", "", "NIP. ..............................."]);
 // Create workbook and add worksheet
 const wb = XLSX.utils.book_new();
 const ws = XLSX.utils.aoa_to_sheet(headerData);
 // Set column widths
 const colWidths = [
   { wch: 6 },  // No.
   { wch: 30 }, // Name
   { wch: 15 }, // NIP/NIK
   { wch: 15 }, // Jabatan
   { wch: 8 },  // Hadir
   { wch: 12 }, // Terlambat
   { wch: 8 },  // Izin
   { wch: 8 },  // Alpha
   { wch: 8 }   // Total
 ];
 ws['!cols'] = colWidths;
 // Add worksheet to workbook
 XLSX.utils.book_append_sheet(wb, ws, "Rekap Kehadiran Guru");
 // Generate filename with current date
 const fileName = `Rekap_Kehadiran_Guru_${formattedMonth.replace(' ', '_')}_${format(new Date(), "ddMMyyyy")}.xlsx`;
 XLSX.writeFile(wb, fileName);
 return fileName;
};