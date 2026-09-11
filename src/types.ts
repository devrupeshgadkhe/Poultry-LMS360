/**
 * Shared Type Definitions for Poultry LMS 360
 */

export interface Farm {
  Id: number;
  FarmName: string;
  OwnerName: string;
  ContactPhone?: string;
  ContactEmail?: string;
  Address?: string;
  IsActive: number;
  CreatedAt?: string;
}

export interface User {
  Id: number;
  FarmId?: number;
  Username: string;
  Email: string;
  PasswordHash?: string;
  Role: 'Admin' | 'Staff' | 'Developer';
  FullName: string;
  IsActive: boolean;
  CreatedAt?: string;
}

export interface FarmSettings {
  Id: number;
  FarmName: string;
  IsGoogleDriveEnabled: boolean;
  CreatedAt?: string;
}

export interface Flock {
  Id: number;
  FlockName: string;
  Breed: string;
  InitialCount: number;
  CurrentCount: number;
  ArrivalDate: string; // ISO Date String
  Status: 'Active' | 'Sold' | 'Inactive';
  EndDate: string | null;
  IsActive: boolean;
  TotalPurchasePrice: number;
  StartDate: string;
  TotalFeedCost: number | null;
  TotalVaccineCost: number | null;
  PerBirdPurchasePrice: number | null;
  AgeInDays: number | null;
  Notes: string;
}

export interface DailyLog {
  Id: number;
  FlockId: number;
  FeedItemId: number | null;
  FeedConsumedKg: number;
  MortalityCount: number;
  EggsCollected: number;
  DamagedEggsCollected: number;
  LogDate: string; // ISO Date String
  FeedCost: number;
  DailyBirdCost: number;
  Notes: string;
  DailyAverageWeight?: number;
  WaterConsumed?: number;
  BirdsEatenBySelf?: number;
  BirdsEatenValue?: number;
  EggsGifted?: number;
  EggsGiftedValue?: number;
  CustomEggPrice?: number | null;
  CustomBirdPrice?: number | null;
}

export interface Vaccination {
  Id: number;
  FlockId: number;
  FlockName?: string;
  VaccineName: string;
  Date: string;
  Cost: number;
  AdministeredBy: string;
  Notes: string;
  Phase?: 'Administered' | 'Scheduled';
  ScheduledDate?: string | null;
}

export interface Inventory {
  Id: number;
  ItemName: string;
  Category: 'Feed' | 'Medicine' | 'Equipment' | 'Sales Item' | 'Raw Ingredient';
  UnitOfMeasurement: string;
  UnitPrice: number;
  SellingPrice: number;
  CurrentStock: number;
  WeightPerUnit: number;
  MinThreshold: number;
  Notes: string;
  AverageLandedCost?: number;
}

export interface EggInventory {
  Id: number;
  GradeOrType: string; // e.g. "Fresh Eggs", "Damaged/Waste Eggs"
  PackSize: 'Single' | 'Dozen' | 'Tray-30';
  Quantity: number;
  UnitPrice: number;
  SellingPrice: number;
}

export interface Customer {
  Id: number;
  FullName: string;
  Email: string;
  Phone: string;
  Company: string;
  OpeningCreditBalance: number;
  CurrentCreditBalance: number;
  Address: string;
}

export interface Supplier {
  Id: number;
  CompanyName: string;
  ContactPerson: string;
  Email: string;
  Phone: string;
  OpeningCreditBalance: number;
  CurrentCreditBalance: number;
  Address: string;
}

export interface Purchase {
  Id: number;
  SupplierId: number | null;
  PurchaseDate: string;
  TotalAmount: number;
  TotalGSTAmount: number;
  OtherTaxes: number;
  ReceivedAmount: number;
  BalanceAmount: number;
  InvoiceNumber: string;
  Status: 'Paid' | 'Partial' | 'Unpaid';
  Notes: string;
  SupplierName?: string; // Appended
}

export interface PurchaseItem {
  Id: number;
  PurchaseId: number;
  InventoryId: number | null;
  ItemType: 'Flock' | 'Inventory' | 'Feed Ingredient';
  Quantity: number;
  UnitPrice: number;
  GSTPercentage: number;
  GSTAmount: number;
  TotalPrice: number;
  WeightPerUnit: number;
  AllocatedOverhead: number;
  FinalLandedAmount: number;
  ItemName?: string; // Appended
}

export interface PurchaseExtraExpense {
  Id: number;
  PurchaseId: number;
  ExpenseName: string;
  Amount: number;
  AllocationMethod: 'ByValue' | 'ByWeight' | 'ByQuantity' | 'Equal';
  TargetInventoryId: number | null;
}

export interface Sale {
  Id: number;
  CustomerId: number;
  SaleDate: string;
  SubTotal: number;
  Discount: number;
  TotalGSTAmount: number;
  OtherCharges: number;
  GrandTotal: number;
  ReceivedAmount: number;
  InvoiceNumber: string;
  Status: 'Paid' | 'Partial' | 'Unpaid';
  Notes: string;
  CustomerName?: string; // Appended
}

export interface SaleItem {
  Id: number;
  SaleId: number;
  ItemType: 'Bird' | 'Egg' | 'General Inventory';
  FlockId: number | null;
  EggInventoryId: number | null;
  InventoryId: number | null;
  Quantity: number;
  UnitPrice: number;
  GSTPercentage: number;
  GSTAmount: number;
  TotalPrice: number;
  ItemName?: string; // Appended
}

export interface TransactionCategory {
  Id: number;
  Name: string;
  IsIncome: boolean;
  Description: string;
}

export interface FinancialTransaction {
  Id: number;
  Date: string;
  Amount: number;
  Type: 'Income' | 'Expense';
  CategoryId: number;
  Notes: string;
  FlockId: number | null;
  EggInventoryId: number | null;
  StaffId: number | null;
  SupplierId: number | null;
  CustomerId: number | null;
  CategoryName?: string; // Appended
}

export interface FoodRecipe {
  Id: number;
  RecipeName: string;
  BatchSizeKg: number;
  Notes: string;
  CreatedAt?: string;
  Ingredients?: RecipeIngredient[];
}

export interface RecipeIngredient {
  Id: number;
  FoodRecipeId: number;
  InventoryId: number;
  Percentage: number;
  WeightKg: number;
  ItemName?: string; // Appended
}

export interface Staff {
  Id: number;
  FullName: string;
  Role: string;
  Email: string;
  Phone: string;
  HireDate: string;
  MonthlySalary: number;
  DailyWages: number;
  FixedBonus: number;
  FixedDeduction: number;
  IsActive: boolean;
}

export interface StaffAttendance {
  Id: number;
  StaffId: number;
  Date: string;
  Status: 'Present' | 'Absent' | 'Leave' | 'Late' | 'HalfDay';
  CheckInTime: string | null;
  CheckOutTime: string | null;
  OvertimeHours: number;
  Notes: string;
  StaffName?: string; // Appended
}

export interface StaffPayroll {
  Id: number;
  StaffId: number;
  Month: number;
  Year: number;
  BaseSalary: number;
  OvertimePay: number;
  Bonus: number;
  Deductions: number;
  NetPayable: number;
  Status: 'Paid' | 'Unpaid' | 'Pending';
  PayDate: string | null;
  TransactionId: number | null;
  StaffName?: string; // Appended
  Role?: string; // Appended
}

export interface Holiday {
  Id: number;
  Date: string;
  Name: string;
  Type: 'Public' | 'Individual';
  StaffId: number | null;
  StaffName?: string;
}

export interface AuditLog {
  Id: number;
  Timestamp: string;
  UserEmail: string;
  Module: string;
  Action: string;
  Parameters: string;
  Status: string;
  ExceptionMessage?: string;
  StackTrace?: string;
  IpAddress?: string;
  HttpMethod?: string;
  Url?: string;
}
