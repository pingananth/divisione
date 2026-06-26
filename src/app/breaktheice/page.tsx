import { google } from 'googleapis';
import BreakTheIceClient, { Attendee } from './BreakTheIceClient';

export const revalidate = 60; // Revalidate every 60 seconds

export default async function BreakTheIcePage() {
  const attendees = await getAttendeesFromSheet();
  return <BreakTheIceClient initialAttendees={attendees} />;
}

async function getAttendeesFromSheet(): Promise<Attendee[]> {
  try {
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_CLIENT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      },
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });

    const sheets = google.sheets({ version: 'v4', auth });
    
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      range: 'Sheet1!A1:Z1000',
    });

    const rows = response.data.values;
    if (!rows || rows.length === 0) return [];

    // The first row contains the headers
    const headers = rows[0];
    
    // Helper to safely find index
    const getIndex = (name: string) => headers.findIndex(h => h?.trim() === name);
    
    const idxName = getIndex('Name');
    const idxClub = getIndex('Form_Club');
    const idxRoleOTP = getIndex('Form_Role in OTP');
    const idxExcommRole = getIndex('Form_Excomm Role');
    const idxIcebreaker = getIndex('Form_My interests/hobbies');
    const idxProfession = getIndex('Form_My profession is');
    const idxPhoto = getIndex('Form_Your recent Photo (upload a picture less than 1 mb)');
    const idxConsent = getIndex('Form_I consent to share this information for Break the ice initiative.');
    const idxDivision = getIndex('Form_Division');
    const idxLinkedin = getIndex('Form_Linkedin URL');

    const attendees: Attendee[] = [];

    // Start from row 1 (skip header)
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      
      const consentVal = row[idxConsent]?.toString().trim().toLowerCase();
      const hasConsent = consentVal === '1' || consentVal === 'true' || consentVal === 'yes';

      if (!hasConsent) continue;

      const rawRoleOTP = row[idxRoleOTP]?.toString().trim() || '';
      const excommRole = row[idxExcommRole]?.toString().trim() || '';
      
      // Two-tier role mapping
      let finalRole = rawRoleOTP;
      if (rawRoleOTP.replace(/\s+/g, '').toLowerCase() === 'clubexcomofficer') {
        finalRole = excommRole;
      }

      let validImage = row[idxPhoto]?.toString().trim() || '';
      try {
        if (validImage && !validImage.startsWith('/')) {
          new URL(validImage);
        }
      } catch (e) {
        validImage = '';
      }

      attendees.push({
        id: `row-${i}`,
        name: row[idxName]?.toString().trim() || 'Unknown',
        image: validImage,
        division: row[idxDivision]?.toString().trim() || '',
        area: '', // Left blank as requested
        role: finalRole || 'Member',
        club: row[idxClub]?.toString().trim() || '',
        profession: row[idxProfession]?.toString().trim() || '',
        icebreaker: row[idxIcebreaker]?.toString().trim() || '',
        linkedin: row[idxLinkedin]?.toString().trim() || '',
        consent: true,
      });
    }

    return attendees;
  } catch (error) {
    console.error('Error fetching sheet data:', error);
    return []; // Return empty on error so page doesn't crash
  }
}
