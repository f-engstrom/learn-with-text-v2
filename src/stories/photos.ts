/** A stand-in for a phone's photo of a printed page, for the stories that read photos (Recognise). */
export async function photoOfText(name = 'page.png'): Promise<File> {
	const canvas = document.createElement('canvas');
	canvas.width = 480;
	canvas.height = 640;
	const g = canvas.getContext('2d')!;
	g.fillStyle = '#f4efe4';
	g.fillRect(0, 0, 480, 640);
	g.fillStyle = '#222';
	g.font = '22px Georgia, serif';
	['Старый мост через реку', 'снова открыт. Его ремонти-', 'ровали почти два года.'].forEach((line, i) => g.fillText(line, 32, 80 + i * 40));
	const blob = await new Promise<Blob>((done) => canvas.toBlob((b) => done(b!), 'image/png'));
	return new File([blob], name, { type: 'image/png' });
}
