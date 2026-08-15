import {NextResponse} from "next/server";
import {requireSessionAddress} from "@/lib/request-auth";
import {acceptSponsorOffer} from "@/lib/gooniverse-server";
export async function POST(request:Request,context:{params:Promise<{id:string}>}){try{const[{id},body,wallet]=await Promise.all([context.params,request.json(),requireSessionAddress()]);return NextResponse.json({offer:await acceptSponsorOffer(wallet,{offerId:id,tokenId:Number(body.tokenId),sponsorId:String(body.sponsorId)})});}catch(error){const message=error instanceof Error?error.message:"Unable to accept sponsor.";return NextResponse.json({error:message},{status:message==="AUTH_REQUIRED"?401:400});}}
