import {NextResponse} from "next/server";
import {requireSessionAddress} from "@/lib/request-auth";
import {getSponsorOffers} from "@/lib/gooniverse-server";
export async function GET(){try{return NextResponse.json({offers:await getSponsorOffers(await requireSessionAddress())});}catch(error){const message=error instanceof Error?error.message:"Unable to load sponsor offers.";return NextResponse.json({error:message},{status:message==="AUTH_REQUIRED"?401:400});}}
