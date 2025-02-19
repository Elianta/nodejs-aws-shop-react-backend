export interface Product {
  id: string;
  title: string;
  description: string;
  price: number;
  count: number;
}

export const products: Product[] = [
  {
    id: "1",
    title: "Product 1",
    description: "Description 1",
    price: 99.99,
    count: 10,
  },
  {
    id: "2",
    title: "Product 2",
    description: "Description 2",
    price: 149.99,
    count: 5,
  },
  {
    id: "3",
    title: "Product 3",
    description: "Description 3",
    price: 199.99,
    count: 3,
  },
  {
    id: "4",
    title: "Product 4",
    description: "Description 4",
    price: 249.99,
    count: 8,
  },
  {
    id: "5",
    title: "Product 5",
    description: "Description 5",
    price: 299.99,
    count: 2,
  },
  {
    id: "6",
    title: "Product 6",
    description: "Description 6",
    price: 349.99,
    count: 6,
  },
  {
    id: "7",
    title: "Product 7",
    description: "Description 7",
    price: 399.99,
    count: 4,
  },
  {
    id: "8",
    title: "Product 8",
    description: "Description 8",
    price: 449.99,
    count: 7,
  },
  {
    id: "9",
    title: "Product 9",
    description: "Description 9",
    price: 499.99,
    count: 1,
  },
  {
    id: "10",
    title: "Product 10",
    description: "Description 10",
    price: 549.99,
    count: 9,
  },
];
