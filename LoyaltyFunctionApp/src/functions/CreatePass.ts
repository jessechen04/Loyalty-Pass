import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";

import * as fs from 'fs';
import * as path from 'path';
const { PKPass } = require('passkit-generator');
//import { PKPass } from 'passkit-generator';

interface CreatePassRequestBody {
  userId?: string;
}

const cert = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'certs', 'cert.pem'));
const key = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'certs', 'key.pem'));
const wwdr = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'certs', 'AppleWWDR.pem'));

export async function CreatePass(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
    context.log(`Http functions processed request for url "${request.url}"`);

    try {
        // "as CreatePassRequestBody" to make sure it uses the interface
        // Basically this is a type assertion to ensure TypeScript knows the shape of the request body
        // const body = await request.json() as CreatePassRequestBody; // <-- THIS is your "req.body"
        // context.log("Parsed request body:", body);
        const userId = request.query.get('userId') ?? "123";

        const pass = await PKPass.from({
            model: path.join(__dirname, '..', '..', '..', 'loyalty_pass'),
            certificates: {
            wwdr: wwdr,
            signerCert: cert,
            signerKey: key,
            }
        });

        context.log("Pass object created");

        pass.serialNumber = `user-${userId}-v3`;
        const barcode = {
            message: `${userId}`,
            format: 'PKBarcodeFormatQR',
            messageEncoding: 'iso-8859-1',
            altText: `Loyalty #: ${userId}`,
        };

        pass.barcode = barcode;   // Backward compatibility
        pass.barcodes = [barcode]; // Modern iOS uses this
        pass.description = `Wallet pass for user ${userId}`;

        //context.log("Pass object created 2");

        // context.log('Generating pass for:', userId);
        // context.log('Using model:', path.join(__dirname, 'loyalty_pass'));
        // context.log('Pass fields:', {
        //     serialNumber: pass.serialNumber,
        //     barcodes: pass.barcodes,
        //     description: pass.description
        // });

        const buffer = await pass.getAsBuffer();

        //fs.writeFileSync(`user-${userId}.pkpass`, buffer);


        return { 
            status: 200,
            headers: {
                'Content-Type': 'application/vnd.apple.pkpass',
                'Content-Disposition': `attachment; filename=user-${userId}.pkpass`
            },
            body: buffer,
        };


    } catch (error: any) {
        context.error('Error creating pass:', error);
        return {
            status: 500,
            body: 'Internal Server Error while creating pass.'
        };
    }
};

app.http('CreatePass', {
    methods: ['GET'],
    authLevel: 'anonymous',
    handler: CreatePass
});
