// import { Request, Response, NextFunction } from "express";
//
// export const requireRole = (role: string) => {
//     return (req: Request, res: Response, next: NextFunction) => {
//         const user = req.user;
//
//         if (!user) {
//             return res.status(401).json({ message: "Not authenticated" });
//         }
//
//         if (user.role !== role) {
//             return res.status(403).json({ message: "Forbidden: insufficient rights" });
//         }
//
//         next();
//     };
// };
