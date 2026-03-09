import { detectReceiptKind, parseItems } from '../src/services/receipt.service';
const input = '6.60\n7290000000000\nביצים טריות\n7290000000123';
process.stdout.write('kind=' + detectReceiptKind(input) + '\n');
process.stdout.write('items=' + JSON.stringify(parseItems(input)) + '\n');
