import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, AlignmentType, HeadingLevel, BorderStyle } from 'docx';
import { Response } from 'express';

export interface OrderData {
  id: number;
  orderNumber: string;
  contractNumber?: string;
  client: {
    name: string;
  };
  items: Array<{
    product: {
      name: string;
      article?: string;
      area?: number;
    };
    quantity: number;
  }>;
  createdAt: string;
}

export interface ShipmentData {
  id: number;
  shipmentNumber: string;
  plannedDate?: string;
  clients: Array<{
    name: string;
    contractNumber?: string;
  }>;
  items: Array<{
    orderNumber: string;
    contractNumber?: string;
    clientName: string;
    product: {
      name: string;
      article?: string;
      area?: number;
    };
    quantity: number;
  }>;
  createdAt: string;
}

export class WordExporter {
  /**
   * Создает и отправляет Word-документ отгрузочного задания
   */
  static async exportShipmentDocument(res: Response, orderData: OrderData): Promise<void> {
    try {
      console.log('📄 Генерация документа для заказа:', orderData.orderNumber);
      console.log('📦 Товары:', orderData.items.map(item => ({
        name: item.product.name,
        article: item.product.article,
        area: item.product.area,
        quantity: item.quantity
      })));
      
      const doc = new Document({
        sections: [{
          properties: {},
          children: [
            // Блок 1: Внимание и заголовок
            new Paragraph({
              children: [
                new TextRun({
                  text: "ВНИМАНИЕ:",
                  bold: true,
                  size: 24
                })
              ],
              alignment: AlignmentType.CENTER
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: "ДОКУМЕНТ ДЛЯ ВНУТРЕННЕГО ПРИМЕНЕНИЯ.",
                  bold: true,
                  size: 20
                })
              ],
              alignment: AlignmentType.CENTER
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: "ПОДЛЕЖИТ ИЗЪЯТИЮ ПРЕДСТАВИТЕЛЕМ ОХРАНЫ",
                  bold: true,
                  size: 20
                })
              ],
              alignment: AlignmentType.CENTER
            }),
            new Paragraph({ text: "" }), // Пустая строка

            // Блок 2: Дата + клиент + транспорт
            new Paragraph({
              children: [
                new TextRun({
                  text: "Поле",
                  bold: true
                })
              ]
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: "Значение"
                })
              ]
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: "Дата"
                })
              ]
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: new Date(orderData.createdAt).toLocaleDateString('ru-RU')
                })
              ]
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: "Название клиента"
                })
              ]
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: orderData.client.name
                })
              ]
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: "Транспорт"
                })
              ]
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: "__________________________"
                })
              ]
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: "ФИО водителя"
                })
              ]
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: "__________________________"
                })
              ]
            }),
            new Paragraph({ text: "" }), // Пустая строка

            // Блок 3: ФИО ответственного
            new Paragraph({
              children: [
                new TextRun({
                  text: "Р.Е. Шведов"
                })
              ],
              alignment: AlignmentType.RIGHT
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: "Е.Н. Сакович"
                })
              ],
              alignment: AlignmentType.RIGHT
            }),
            new Paragraph({ text: "" }), // Пустая строка

            // Блок 4: Таблица с товарами
            new Paragraph({
              children: [
                new TextRun({
                  text: "Товары:",
                  bold: true
                })
              ]
            }),
            this.createProductsTable(orderData),
            new Paragraph({ text: "" }), // Пустая строка

            // Блок 5: Примечания
            new Paragraph({
              children: [
                new TextRun({
                  text: "Примечание: ________________________________________"
                })
              ]
            }),
            new Paragraph({ text: "" }), // Пустая строка

            // Блок 6: Товарный ярлык
            new Paragraph({
              children: [
                new TextRun({
                  text: "Товарный ярлык:"
                })
              ]
            }),
            new Paragraph({ text: "" }), // Пустая строка

            // Блок 7: Составил
            new Paragraph({
              children: [
                new TextRun({
                  text: "СОСТАВИЛ: ______________________ / _________________ /"
                })
              ]
            }),
            new Paragraph({ text: "" }), // Пустая строка

            // Блок 8: Отгрузку осуществили
            new Paragraph({
              children: [
                new TextRun({
                  text: "Отгрузку осуществили:",
                  bold: true
                })
              ]
            }),
            this.createShipmentTable(),
            new Paragraph({ text: "" }), // Пустая строка

            // Блок 9: Контроль отгрузки
            new Paragraph({
              children: [
                new TextRun({
                  text: "ПРОЦЕСС ОТГРУЗКИ ПРОКОНТРОЛИРОВАЛ:",
                  bold: true
                })
              ]
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: "________________ / __________________ /"
                })
              ]
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: "        (Ф.И.О.)                (Подпись)"
                })
              ]
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: "ВРЕМЯ ОТМЕТКА выезда с территории:"
                })
              ]
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: "час: _____  мин: _____"
                })
              ]
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: "Представитель службы охраны: ___________"
                })
              ]
            })
          ]
        }]
      });

      // Генерируем буфер документа
      const buffer = await Packer.toBuffer(doc);

      // Устанавливаем заголовки HTTP для скачивания файла
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      
      // Правильно кодируем имя файла для кириллицы
      const fileName = `Shipment_${orderData.orderNumber}.docx`;
      const encodedFileName = encodeURIComponent(fileName);
      res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodedFileName}`);
      res.setHeader('Content-Length', buffer.length);

      // Отправляем файл
      res.send(buffer);
    } catch (error) {
      console.error('Ошибка при генерации Word-документа:', error);
      throw new Error('Не удалось сгенерировать документ отгрузочного задания');
    }
  }

  /**
   * Создает и отправляет Word-документ отгрузочного задания для всей отгрузки
   */
  static async exportShipmentDocumentForShipment(res: Response, shipmentData: ShipmentData): Promise<void> {
    try {
      console.log('📄 Генерация документа для отгрузки:', shipmentData.shipmentNumber);
      console.log('📦 Товары в отгрузке:', shipmentData.items.length);
      console.log('👥 Клиенты:', shipmentData.clients.map(c => c.name));
      
      // Проверяем, есть ли товары в отгрузке
      if (!shipmentData.items || shipmentData.items.length === 0) {
        throw new Error('В отгрузке нет товаров для генерации документа');
      }

      // Сортируем товары по номеру договора, затем по артикулу
      const sortedItems = [...shipmentData.items].sort((a, b) => {
        const contractA = a.contractNumber || '';
        const contractB = b.contractNumber || '';
        if (contractA !== contractB) {
          return contractA.localeCompare(contractB);
        }
        const articleA = a.product.article || '';
        const articleB = b.product.article || '';
        return articleA.localeCompare(articleB);
      });

      // Вычисляем итоги
      const totalQuantity = sortedItems.reduce((sum, item) => sum + item.quantity, 0);
      const totalArea = sortedItems.reduce((sum, item) => {
        const area = (item.product.area || 0) * item.quantity;
        return sum + area;
      }, 0);

      const doc = new Document({
        sections: [{
          properties: {},
          children: [
            // Блок 1: Внимание и заголовок
            new Paragraph({
              children: [
                new TextRun({
                  text: "ВНИМАНИЕ:",
                  bold: true,
                  size: 24
                })
              ],
              alignment: AlignmentType.CENTER
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: "ДОКУМЕНТ ДЛЯ ВНУТРЕННЕГО ПРИМЕНЕНИЯ.",
                  bold: true,
                  size: 20
                })
              ],
              alignment: AlignmentType.CENTER
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: "ПОДЛЕЖИТ ИЗЪЯТИЮ ПРЕДСТАВИТЕЛЕМ ОХРАНЫ",
                  bold: true,
                  size: 20
                })
              ],
              alignment: AlignmentType.CENTER
            }),
            new Paragraph({ text: "" }), // Пустая строка

            // Блок 2: Дата + клиенты + транспорт
            new Paragraph({
              children: [
                new TextRun({
                  text: "Номер отгрузки:",
                  bold: true
                })
              ]
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: shipmentData.shipmentNumber
                })
              ]
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: "Дата отгрузки:",
                  bold: true
                })
              ]
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: shipmentData.plannedDate 
                    ? new Date(shipmentData.plannedDate).toLocaleDateString('ru-RU')
                    : new Date().toLocaleDateString('ru-RU')
                })
              ]
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: "Заказчики:",
                  bold: true
                })
              ]
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: shipmentData.clients.map(c => c.name).join(', ')
                })
              ]
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: "Транспорт:"
                })
              ]
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: "__________________________"
                })
              ]
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: "ФИО водителя:"
                })
              ]
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: "__________________________"
                })
              ]
            }),
            new Paragraph({ text: "" }), // Пустая строка

            // Блок 3: ФИО ответственного
            new Paragraph({
              children: [
                new TextRun({
                  text: "Р.Е. Шведов"
                })
              ],
              alignment: AlignmentType.RIGHT
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: "Е.Н. Сакович"
                })
              ],
              alignment: AlignmentType.RIGHT
            }),
            new Paragraph({ text: "" }), // Пустая строка

            // Блок 4: Таблица с товарами
            new Paragraph({
              children: [
                new TextRun({
                  text: "Товары в отгрузке:",
                  bold: true
                })
              ]
            }),
            this.createShipmentProductsTable(sortedItems, totalQuantity, totalArea),
            new Paragraph({ text: "" }), // Пустая строка

            // Блок 5: Примечания
            new Paragraph({
              children: [
                new TextRun({
                  text: "Примечания: ____________________________________________________________________"
                })
              ]
            }),
            new Paragraph({ text: "" }), // Пустая строка

            // Блок 6: Товарный ярлык
            new Paragraph({
              children: [
                new TextRun({
                  text: "Товарный ярлык:"
                })
              ]
            }),
            new Paragraph({ text: "" }), // Пустая строка

            // Блок 7: Составил
            new Paragraph({
              children: [
                new TextRun({
                  text: "СОСТАВИЛ: ____________________________   /   ____________________________  /"
                })
              ]
            }),
            new Paragraph({ text: "" }), // Пустая строка

            // Блок 8: Отгрузку осуществили
            new Paragraph({
              children: [
                new TextRun({
                  text: "ОТГРУЗКУ СОГЛАСНО ЗАДАНИЯ ОСУЩЕСТВИЛИ:",
                  bold: true
                })
              ]
            }),
            this.createShipmentTable(),
            new Paragraph({ text: "" }), // Пустая строка

            // Блок 9: Контроль отгрузки
            new Paragraph({
              children: [
                new TextRun({
                  text: "ПРОЦЕСС ОТГРУЗКИ ПРОКОНТРОЛИРОВАЛ:",
                  bold: true
                })
              ]
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: "__________________________ / __________________________ /"
                })
              ]
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: "         (Ф.И.О.)                      (Подпись)"
                })
              ]
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: "ВРЕМЯ ОТМЕТКА выезда с территории:"
                })
              ]
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: "час: ______    минут: ______"
                })
              ]
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: "Представитель службы охраны: __________________________"
                })
              ]
            })
          ]
        }]
      });

      // Генерируем буфер документа
      const buffer = await Packer.toBuffer(doc);

      // Устанавливаем заголовки HTTP для скачивания файла
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      
      // Правильно кодируем имя файла для кириллицы
      const dateStr = shipmentData.plannedDate 
        ? new Date(shipmentData.plannedDate).toISOString().split('T')[0]
        : new Date().toISOString().split('T')[0];
      const fileName = `Shipment_${shipmentData.shipmentNumber}_${dateStr}.docx`;
      const encodedFileName = encodeURIComponent(fileName);
      res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodedFileName}`);
      res.setHeader('Content-Length', buffer.length);

      // Отправляем файл
      res.send(buffer);
    } catch (error) {
      console.error('Ошибка при генерации Word-документа отгрузки:', error);
      throw new Error('Не удалось сгенерировать документ отгрузочного задания');
    }
  }

  /**
   * Создает таблицу с товарами
   */
  private static createProductsTable(orderData: OrderData): Table {
    const rows = [
      // Заголовки
      new TableRow({
        children: [
          new TableCell({
            children: [new Paragraph({
              children: [new TextRun({ text: "Номер договора", bold: true })]
            })],
            width: { size: 20, type: WidthType.PERCENTAGE }
          }),
          new TableCell({
            children: [new Paragraph({
              children: [new TextRun({ text: "Наименование товара", bold: true })]
            })],
            width: { size: 40, type: WidthType.PERCENTAGE }
          }),
          new TableCell({
            children: [new Paragraph({
              children: [new TextRun({ text: "Кол-во, шт", bold: true })]
            })],
            width: { size: 15, type: WidthType.PERCENTAGE }
          }),
          new TableCell({
            children: [new Paragraph({
              children: [new TextRun({ text: "Площадь, м.кв.", bold: true })]
            })],
            width: { size: 25, type: WidthType.PERCENTAGE }
          })
        ]
      })
    ];

    // Добавляем строки с товарами
    orderData.items.forEach(item => {
      const productName = item.product.article 
        ? `${item.product.article} ${item.product.name}`
        : item.product.name;
      
      const area = (item.product.area || 0) * item.quantity;
      const areaText = area > 0 ? area.toFixed(2) : '0';

      rows.push(
        new TableRow({
          children: [
            new TableCell({
              children: [new Paragraph({
                children: [new TextRun({ text: orderData.contractNumber || '' })]
              })]
            }),
            new TableCell({
              children: [new Paragraph({
                children: [new TextRun({ text: productName })]
              })]
            }),
            new TableCell({
              children: [new Paragraph({
                children: [new TextRun({ text: item.quantity.toString() })]
              })]
            }),
            new TableCell({
              children: [new Paragraph({
                children: [new TextRun({ text: areaText })]
              })]
            })
          ]
        })
      );
    });

    return new Table({
      rows,
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: {
        top: { style: BorderStyle.SINGLE },
        bottom: { style: BorderStyle.SINGLE },
        left: { style: BorderStyle.SINGLE },
        right: { style: BorderStyle.SINGLE },
        insideHorizontal: { style: BorderStyle.SINGLE },
        insideVertical: { style: BorderStyle.SINGLE }
      }
    });
  }

  /**
   * Создает таблицу с товарами отгрузки
   */
  private static createShipmentProductsTable(items: any[], totalQuantity: number, totalArea: number): Table {
    const rows = [
      // Заголовки
      new TableRow({
        children: [
          new TableCell({
            children: [new Paragraph({
              children: [new TextRun({ text: "Договор", bold: true })]
            })],
            width: { size: 15, type: WidthType.PERCENTAGE }
          }),
          new TableCell({
            children: [new Paragraph({
              children: [new TextRun({ text: "Клиент", bold: true })]
            })],
            width: { size: 25, type: WidthType.PERCENTAGE }
          }),
          new TableCell({
            children: [new Paragraph({
              children: [new TextRun({ text: "Артикул / Наименование", bold: true })]
            })],
            width: { size: 30, type: WidthType.PERCENTAGE }
          }),
          new TableCell({
            children: [new Paragraph({
              children: [new TextRun({ text: "Кол-во", bold: true })]
            })],
            width: { size: 10, type: WidthType.PERCENTAGE }
          }),
          new TableCell({
            children: [new Paragraph({
              children: [new TextRun({ text: "м.кв.", bold: true })]
            })],
            width: { size: 10, type: WidthType.PERCENTAGE }
          }),
          new TableCell({
            children: [new Paragraph({
              children: [new TextRun({ text: "Примечание", bold: true })]
            })],
            width: { size: 10, type: WidthType.PERCENTAGE }
          })
        ]
      })
    ];

    // Добавляем строки с товарами
    items.forEach(item => {
      const productName = item.product.article 
        ? `${item.product.article} ${item.product.name}`
        : item.product.name;
      
      const area = (item.product.area || 0) * item.quantity;
      const areaText = area > 0 ? area.toFixed(2) : '0,00';

      rows.push(
        new TableRow({
          children: [
            new TableCell({
              children: [new Paragraph({
                children: [new TextRun({ text: item.contractNumber || '' })]
              })]
            }),
            new TableCell({
              children: [new Paragraph({
                children: [new TextRun({ text: item.clientName })]
              })]
            }),
            new TableCell({
              children: [new Paragraph({
                children: [new TextRun({ text: productName })]
              })]
            }),
            new TableCell({
              children: [new Paragraph({
                children: [new TextRun({ text: item.quantity.toString() })]
              })]
            }),
            new TableCell({
              children: [new Paragraph({
                children: [new TextRun({ text: areaText })]
              })]
            }),
            new TableCell({
              children: [new Paragraph({
                children: [new TextRun({ text: "" })]
              })]
            })
          ]
        })
      );
    });

    // Добавляем строку итогов
    rows.push(
      new TableRow({
        children: [
          new TableCell({
            children: [new Paragraph({
              children: [new TextRun({ text: "Итого", bold: true })]
            })]
          }),
          new TableCell({
            children: [new Paragraph({
              children: [new TextRun({ text: "" })]
            })]
          }),
          new TableCell({
            children: [new Paragraph({
              children: [new TextRun({ text: "" })]
            })]
          }),
          new TableCell({
            children: [new Paragraph({
              children: [new TextRun({ text: totalQuantity.toString(), bold: true })]
            })]
          }),
          new TableCell({
            children: [new Paragraph({
              children: [new TextRun({ text: totalArea.toFixed(2), bold: true })]
            })]
          }),
          new TableCell({
            children: [new Paragraph({
              children: [new TextRun({ text: "" })]
            })]
          })
        ]
      })
    );

    return new Table({
      rows,
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: {
        top: { style: BorderStyle.SINGLE },
        bottom: { style: BorderStyle.SINGLE },
        left: { style: BorderStyle.SINGLE },
        right: { style: BorderStyle.SINGLE },
        insideHorizontal: { style: BorderStyle.SINGLE },
        insideVertical: { style: BorderStyle.SINGLE }
      }
    });
  }

  /**
   * Создает таблицу отгрузки
   */
  private static createShipmentTable(): Table {
    return new Table({
      rows: [
        new TableRow({
          children: [
            new TableCell({
              children: [new Paragraph({
                children: [new TextRun({ text: "Операция", bold: true })]
              })],
              width: { size: 25, type: WidthType.PERCENTAGE }
            }),
            new TableCell({
              children: [new Paragraph({
                children: [new TextRun({ text: "ФИО сотрудника", bold: true })]
              })],
              width: { size: 20, type: WidthType.PERCENTAGE }
            }),
            new TableCell({
              children: [new Paragraph({
                children: [new TextRun({ text: "Подпись", bold: true })]
              })],
              width: { size: 15, type: WidthType.PERCENTAGE }
            }),
            new TableCell({
              children: [new Paragraph({
                children: [new TextRun({ text: "ФИО охранника", bold: true })]
              })],
              width: { size: 20, type: WidthType.PERCENTAGE }
            }),
            new TableCell({
              children: [new Paragraph({
                children: [new TextRun({ text: "Подпись", bold: true })]
              })],
              width: { size: 15, type: WidthType.PERCENTAGE }
            }),
            new TableCell({
              children: [new Paragraph({
                children: [new TextRun({ text: "Дата, время", bold: true })]
              })],
              width: { size: 25, type: WidthType.PERCENTAGE }
            })
          ]
        }),
        new TableRow({
          children: [
            new TableCell({
              children: [new Paragraph({
                children: [new TextRun({ text: "Чистка от материала (каши)" })]
              })]
            }),
            new TableCell({
              children: [new Paragraph({
                children: [new TextRun({ text: "" })]
              })]
            }),
            new TableCell({
              children: [new Paragraph({
                children: [new TextRun({ text: "" })]
              })]
            }),
            new TableCell({
              children: [new Paragraph({
                children: [new TextRun({ text: "" })]
              })]
            }),
            new TableCell({
              children: [new Paragraph({
                children: [new TextRun({ text: "" })]
              })]
            }),
            new TableCell({
              children: [new Paragraph({
                children: [new TextRun({ text: "" })]
              })]
            })
          ]
        }),
        new TableRow({
          children: [
            new TableCell({
              children: [new Paragraph({
                children: [new TextRun({ text: "Проверка на наличие металл." })]
              })]
            }),
            new TableCell({
              children: [new Paragraph({
                children: [new TextRun({ text: "" })]
              })]
            }),
            new TableCell({
              children: [new Paragraph({
                children: [new TextRun({ text: "" })]
              })]
            }),
            new TableCell({
              children: [new Paragraph({
                children: [new TextRun({ text: "" })]
              })]
            }),
            new TableCell({
              children: [new Paragraph({
                children: [new TextRun({ text: "" })]
              })]
            }),
            new TableCell({
              children: [new Paragraph({
                children: [new TextRun({ text: "" })]
              })]
            })
          ]
        }),
        new TableRow({
          children: [
            new TableCell({
              children: [new Paragraph({
                children: [new TextRun({ text: "Кладовщик" })]
              })]
            }),
            new TableCell({
              children: [new Paragraph({
                children: [new TextRun({ text: "" })]
              })]
            }),
            new TableCell({
              children: [new Paragraph({
                children: [new TextRun({ text: "" })]
              })]
            }),
            new TableCell({
              children: [new Paragraph({
                children: [new TextRun({ text: "" })]
              })]
            }),
            new TableCell({
              children: [new Paragraph({
                children: [new TextRun({ text: "" })]
              })]
            }),
            new TableCell({
              children: [new Paragraph({
                children: [new TextRun({ text: "" })]
              })]
            })
          ]
        })
      ],
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: {
        top: { style: BorderStyle.SINGLE },
        bottom: { style: BorderStyle.SINGLE },
        left: { style: BorderStyle.SINGLE },
        right: { style: BorderStyle.SINGLE },
        insideHorizontal: { style: BorderStyle.SINGLE },
        insideVertical: { style: BorderStyle.SINGLE }
      }
    });
  }
}
