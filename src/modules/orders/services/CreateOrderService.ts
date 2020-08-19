import { inject, injectable } from 'tsyringe';

import AppError from '@shared/errors/AppError';

import IProductsRepository from '@modules/products/repositories/IProductsRepository';
import ICustomersRepository from '@modules/customers/repositories/ICustomersRepository';
import Order from '../infra/typeorm/entities/Order';
import IOrdersRepository from '../repositories/IOrdersRepository';

interface IProduct {
  id: string;
  quantity: number;
}

interface IRequest {
  customer_id: string;
  products: IProduct[];
}

@injectable()
class CreateOrderService {
  constructor(
    @inject('OrdersRepository')
    private ordersRepository: IOrdersRepository,
    @inject('ProductsRepository')
    private productsRepository: IProductsRepository,
    @inject('CustomersRepository')
    private customersRepository: ICustomersRepository,
  ) {}

  public async execute({ customer_id, products }: IRequest): Promise<Order> {
    const custumersExists = await this.customersRepository.findById(customer_id);

    if(!custumersExists){
      throw new AppError('Could not find any customer with the given id');      
    }
    const existentProducts = await this.productsRepository.findAllById(products);

    if(!existentProducts.length){
      throw new AppError("Colud not find any products with thhe given ids");      
    }
    const existentProductsIds = existentProducts.map(product => product.id);

    const checkInexistentsProducts = products.filter(
      product => !existentProductsIds.includes(product.id)
    );

    if(checkInexistentsProducts.length){
      throw new AppError(`Could not fin product${checkInexistentsProducts[0].id} `);      
    }

    const findProductWithNoQuantityAvailable = products.filter(
      product => 
      existentProducts.filter(p=> p.id === product.id)[0].quantity < product.quantity
    );
    if(findProductWithNoQuantityAvailable.length){
      throw new AppError(`The quantityt ${findProductWithNoQuantityAvailable[0].quantity} is not available for ${findProductWithNoQuantityAvailable[0].id}`);      
    }

    const serializeProduct = products.map(product => ({
      product_id: product.id,
      quantity: product.quantity,
      price: existentProducts.filter(p=>p.id === product.id)[0].price,
    }));
    
    const order = await this.ordersRepository.create({
      customer: custumersExists,
      products: serializeProduct,
    });

    const {order_products} = order;

    const orderedProductsQuantity = order_products.map(product =>({
      id:product.product_id,
      quantity:
      existentProducts.filter(p => p.id === product.product_id)[0].quantity - product.quantity,
    }));
    await this.productsRepository.updateQuantity(orderedProductsQuantity);

    return order;

  }
}

export default CreateOrderService;
