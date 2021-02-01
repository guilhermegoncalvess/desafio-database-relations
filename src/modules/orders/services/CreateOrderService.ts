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
  ) {
    //
  }

  public async execute({ customer_id, products }: IRequest): Promise<Order> {
    const foundCustomer = await this.customersRepository.findById(customer_id);

    if (!foundCustomer) {
      throw new AppError('Customer does not exist');
    }

    const foundProducts = await this.productsRepository.findAllById(products);

    if (!foundProducts.length) {
      throw new AppError('No product was found for the given IDs');
    }

    const foundProductsIds = foundProducts.map(product => product.id);

    const notFoundProducts = products.filter(
      product => !foundProductsIds.includes(product.id),
    );

    if (notFoundProducts.length) {
      throw new AppError(`product ${notFoundProducts[0].id} was not found`);
    }

    const unavailableProducts = products.filter(
      product =>
        foundProducts.filter(prod => prod.id === product.id)[0].quantity <
        product.quantity,
    );

    if (unavailableProducts.length) {
      throw new AppError(
        `product ${unavailableProducts[0].id} is not available for the given quantity`,
      );
    }

    const availableProducts = products.map(product => ({
      product_id: product.id,
      quantity: product.quantity,
      price: foundProducts.filter(prod => prod.id === product.id)[0].price,
    }));

    const order = await this.ordersRepository.create({
      customer: foundCustomer,
      products: availableProducts,
    });

    const orderedProducts = order.order_products.map(product => ({
      id: product.product_id,
      quantity:
        foundProducts.filter(prod => prod.id === product.product_id)[0]
          .quantity - product.quantity,
    }));

    await this.productsRepository.updateQuantity(orderedProducts);

    return order;
  }
}

export default CreateOrderService;
